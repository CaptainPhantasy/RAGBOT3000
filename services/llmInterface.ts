import { getMemoryManager, type MemoryFile } from '../memory/memoryManager';

export interface LLMCommand {
  id: string;
  command: string;
  parameters?: Record<string, any>;
  timestamp: number;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  result?: any;
  error?: string;
}

export interface LLMResponse {
  type: 'observation_data' | 'navigation_guidance' | 'analysis_result' | 'error';
  data: any;
  timestamp: number;
  for_llm?: boolean;
  for_human?: boolean;
}

export class LLMInterface {
  private memoryManager = getMemoryManager();
  private commandQueue: LLMCommand[] = [];
  private isProcessing = false;
  
  // API endpoint for LLM to read observations
  public async getLatestObservations(verbosity: 'minimal' | 'standard' | 'verbose' = 'verbose'): Promise<string> {
    const memory = this.memoryManager.getMemory();
    const latest = this.memoryManager.getLatestObservation();
    
    if (!latest) {
      return JSON.stringify({
        status: 'no_observations',
        message: 'No page analysis available',
        session_id: memory.session_id,
        current_url: memory.current_url
      }, null, 2);
    }
    
    let response: any = {
      status: 'success',
      session_id: memory.session_id,
      current_url: memory.current_url,
      page_title: latest.page_title,
      timestamp: latest.timestamp,
      
      // Navigation guidance for LLM interaction
      navigation_guidance: latest.navigation_guidance,
      
      // Critical issues first
      critical_issues: latest.summary.critical_issues,
      
      // Recommended fixes
      recommended_fixes: latest.summary.recommended_fixes,
      
      // Pending commands for the RAGBOT
      pending_commands: this.memoryManager.getPendingCommands()
    };
    
    // Add more detail based on verbosity level
    if (verbosity === 'standard' || verbosity === 'verbose') {
      response.layout = latest.layout;
      response.accessibility_summary = {
        wcag_level: latest.accessibility.wcag_compliance.level,
        violation_count: latest.accessibility.wcag_compliance.violations.length,
        keyboard_issues: latest.accessibility.keyboard_navigation.tab_order_issues.length
      };
      response.ux_issues = latest.ux_assessment.navigation_flow.user_flow_issues;
    }
    
    if (verbosity === 'verbose') {
      // Include full detailed analysis
      response.full_analysis = {
        visual: latest.visual_analysis,
        css: latest.css_analysis,
        content: latest.content_analysis,
        accessibility: latest.accessibility,
        technical: latest.technical_issues,
        ux: latest.ux_assessment
      };
    }
    
    return JSON.stringify(response, null, 2);
  }
  
  // API endpoint for LLM to send commands
  public async sendCommand(command: string, parameters?: Record<string, any>): Promise<string> {
    const cmdId = `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const llmCommand: LLMCommand = {
      id: cmdId,
      command,
      parameters,
      timestamp: Date.now(),
      status: 'pending'
    };
    
    this.commandQueue.push(llmCommand);
    this.memoryManager.addCommand(JSON.stringify(llmCommand));
    
    // Process the command
    const result = await this.processCommand(llmCommand);
    
    return JSON.stringify({
      command_id: cmdId,
      status: result.status,
      result: result.result,
      error: result.error
    }, null, 2);
  }
  
  // Process commands from LLM
  private async processCommand(command: LLMCommand): Promise<{ status: string; result?: any; error?: string }> {
    command.status = 'executing';
    
    try {
      switch (command.command) {
        case 'click_element':
          return await this.clickElement(command.parameters?.selector);
          
        case 'navigate':
          return await this.navigateTo(command.parameters?.url);
          
        case 'extract_text':
          return await this.extractText(command.parameters?.selector);
          
        case 'get_element_property':
          return await this.getElementProperty(command.parameters?.selector, command.parameters?.property);
          
        case 'wait_for_element':
          return await this.waitForElement(command.parameters?.selector, command.parameters?.timeout);
          
        case 'scroll_to_element':
          return await this.scrollToElement(command.parameters?.selector);
          
        case 'take_screenshot':
          return await this.takeScreenshot(command.parameters?.region);
          
        case 'analyze_element':
          return await this.analyzeElement(command.parameters?.selector);
          
        default:
          return {
            status: 'failed',
            error: `Unknown command: ${command.command}`
          };
      }
    } catch (error) {
      command.status = 'failed';
      command.error = error instanceof Error ? error.message : 'Unknown error';
      return {
        status: 'failed',
        error: command.error
      };
    }
  }
  
  // Command implementations
  private async clickElement(selector: string): Promise<{ status: string; result?: any }> {
    const element = document.querySelector(selector);
    if (!element) {
      return {
        status: 'failed',
        error: `Element not found: ${selector}`
      };
    }
    
    (element as HTMLElement).click();
    
    // Wait a bit for any navigation or changes
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return {
      status: 'completed',
      result: {
        action: 'clicked',
        element: selector,
        new_url: window.location.href
      }
    };
  }
  
  private async navigateTo(url: string): Promise<{ status: string; result?: any }> {
    if (!url) {
      return {
        status: 'failed',
        error: 'URL is required'
      };
    }
    
    window.location.href = url;
    
    // Note: The page will navigate away, so this might not return
    return {
      status: 'completed',
      result: {
        action: 'navigating',
        to: url
      }
    };
  }
  
  private async extractText(selector: string): Promise<{ status: string; result?: any }> {
    const elements = document.querySelectorAll(selector);
    if (elements.length === 0) {
      return {
        status: 'failed',
        error: `No elements found: ${selector}`
      };
    }
    
    const texts = Array.from(elements).map(el => ({
      element: this.generateSelector(el),
      text: el.textContent?.trim() || '',
      visible: this.isVisible(el)
    }));
    
    return {
      status: 'completed',
      result: texts
    };
  }
  
  private async getElementProperty(selector: string, property: string): Promise<{ status: string; result?: any }> {
    const element = document.querySelector(selector);
    if (!element) {
      return {
        status: 'failed',
        error: `Element not found: ${selector}`
      };
    }
    
    const style = window.getComputedStyle(element);
    const value = style.getPropertyValue(property) || (element as any)[property];
    
    return {
      status: 'completed',
      result: {
        element: selector,
        property,
        value
      }
    };
  }
  
  private async waitForElement(selector: string, timeout = 5000): Promise<{ status: string; result?: any }> {
    const startTime = Date.now();
    
    return new Promise(resolve => {
      const checkInterval = setInterval(() => {
        const element = document.querySelector(selector);
        if (element) {
          clearInterval(checkInterval);
          resolve({
            status: 'completed',
            result: {
              element: selector,
              found: true,
              wait_time: Date.now() - startTime
            }
          });
        } else if (Date.now() - startTime > timeout) {
          clearInterval(checkInterval);
          resolve({
            status: 'failed',
            error: `Element ${selector} not found within ${timeout}ms`
          });
        }
      }, 100);
    });
  }
  
  private async scrollToElement(selector: string): Promise<{ status: string; result?: any }> {
    const element = document.querySelector(selector);
    if (!element) {
      return {
        status: 'failed',
        error: `Element not found: ${selector}`
      };
    }
    
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    return {
      status: 'completed',
      result: {
        element: selector,
        scrolled: true
      }
    };
  }
  
  private async takeScreenshot(region?: string): Promise<{ status: string; result?: any }> {
    // This would need to be implemented with appropriate APIs
    // For now, return a placeholder
    return {
      status: 'failed',
      error: 'Screenshot functionality not available in this context'
    };
  }
  
  private async analyzeElement(selector: string): Promise<{ status: string; result?: any }> {
    const element = document.querySelector(selector);
    if (!element) {
      return {
        status: 'failed',
        error: `Element not found: ${selector}`
      };
    }
    
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    
    return {
      status: 'completed',
      result: {
        element: selector,
        tag: element.tagName.toLowerCase(),
        id: element.id || null,
        classes: Array.from(element.classList),
        text: element.textContent?.trim() || '',
        visible: this.isVisible(element),
        position: {
          x: Math.round(rect.left),
          y: Math.round(rect.top),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        },
        styles: {
          display: style.display,
          position: style.position,
          color: style.color,
          backgroundColor: style.backgroundColor,
          fontSize: style.fontSize,
          fontFamily: style.fontFamily,
          zIndex: style.zIndex
        },
        attributes: Array.from(element.attributes).map(attr => ({
          name: attr.name,
          value: attr.value
        }))
      }
    };
  }
  
  // Utility methods
  private isVisible(element: Element): boolean {
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    
    return style.display !== 'none' && 
           style.visibility !== 'hidden' && 
           style.opacity !== '0' &&
           rect.width > 0 && 
           rect.height > 0;
  }
  
  private generateSelector(element: Element): string {
    if (element.id) return `#${element.id}`;
    if (element.className) return `.${element.className.split(' ').join('.')}`;
    return element.tagName.toLowerCase();
  }
  
  // Public API endpoints (to be exposed for LLM consumption)
  public getEndpointHandlers() {
    return {
      // GET /observations?verbosity=verbose
      getObservations: this.getLatestObservations.bind(this),
      
      // POST /command
      sendCommand: this.sendCommand.bind(this),
      
      // GET /memory (full memory dump)
      getMemory: () => JSON.stringify(this.memoryManager.getMemory(), null, 2),
      
      // GET /status
      getStatus: () => JSON.stringify({
        session_id: this.memoryManager.getMemory().session_id,
        current_url: window.location.href,
        page_title: document.title,
        pending_commands: this.memoryManager.getPendingCommands(),
        last_analysis: this.memoryManager.getLatestObservation()?.timestamp
      }, null, 2)
    };
  }
}

// Create singleton instance
export const llmInterface = new LLMInterface();