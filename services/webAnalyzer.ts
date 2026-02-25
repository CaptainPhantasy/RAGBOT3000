import { WebObservation } from '../memory/types';
import { getMemoryManager } from '../memory/memoryManager';
import { CSSAnalyzer, type CSSAnalysis } from './cssAnalyzer';
import { MarkdownCommunication } from './markdownCommunication';

declare global {
  interface Window {
    axe: any;
  }
}

// Load axe-core for accessibility testing
const loadAxe = async (): Promise<boolean> => {
  if (typeof window.axe !== 'undefined') {
    return true;
  }
  
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/axe-core@4.8.2/axe.min.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
};

// Calculate color contrast ratio
function getContrastRatio(rgb1: [number, number, number], rgb2: [number, number, number]): number {
  const getLuminance = (rgb: [number, number, number]) => {
    const [r, g, b] = rgb.map(val => {
      val = val / 255;
      return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  
  const l1 = getLuminance(rgb1);
  const l2 = getLuminance(rgb2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  
  return (lighter + 0.05) / (darker + 0.05);
}

// Convert color to RGB
function hexToRgb(hex: string): [number, number, number] | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ] : null;
}

function getComputedStyleRgb(element: Element, property: string): [number, number, number] | null {
  const style = window.getComputedStyle(element);
  const value = style.getPropertyValue(property);
  
  if (value.startsWith('#')) {
    return hexToRgb(value);
  } else if (value.startsWith('rgb')) {
    const matches = value.match(/\d+/g);
    if (matches && matches.length >= 3) {
      return [
        parseInt(matches[0]),
        parseInt(matches[1]),
        parseInt(matches[2])
      ];
    }
  }
  
  return null;
}

export class WebAnalyzer {
  private memoryManager = getMemoryManager();
  private cssAnalyzer = new CSSAnalyzer();
  private markdownComms = new MarkdownCommunication();

  async analyzeCurrentPage(): Promise<WebObservation> {
    const startTime = Date.now();
    const url = window.location.href;
    const title = document.title;
    
    console.log(`[WEB-ANALYZER] Starting analysis of: ${url}`);
    
    const observation: WebObservation = {
      id: `obs_${startTime}`,
      timestamp: startTime,
      url,
      page_title: title,
      
      // Visual Layout
      layout: this.analyzeLayout(),
      
      // Visual Analysis
      visual_analysis: this.analyzeVisualDesign(),
      
      // CSS Analysis
      css_analysis: this.cssAnalyzer.analyzeCSS(),
      
      // Content Analysis
      content_analysis: this.analyzeContent(),
      
      // Accessibility
      accessibility: await this.analyzeAccessibility(),
      
      // Technical Issues
      technical_issues: this.analyzeTechnicalIssues(),
      
      // UX Assessment
      ux_assessment: this.analyzeUX(),
      
      // Navigation Guidance
      navigation_guidance: this.analyzeNavigationGuidance(),
      
      // Summary
      summary: {
        overall_score: 0,
        critical_issues: [],
        recommended_fixes: [],
        positive_aspects: []
      }
    };

    // Calculate summary scores
    observation.summary = this.generateSummary(observation);
    
    console.log(`[WEB-ANALYZER] Analysis complete in ${Date.now() - startTime}ms`);
    
    // Store in memory
    this.memoryManager.addObservation(observation);
    
    // Write to markdown for LLM consumption
    this.markdownComms.writeObservation(observation);
    
    return observation;
  }

  private analyzeLayout() {
    const headerElements = Array.from(document.querySelectorAll('header, .header, .navbar, .nav, [role="banner"]'))
      .map(el => `${el.tagName.toLowerCase()}${el.className ? '.' + el.className.split(' ').join('.') : ''}${el.id ? '#' + el.id : ''}`);
    
    const navElements = Array.from(document.querySelectorAll('nav, .navigation, .menu, [role="navigation"]'))
      .map(el => `${el.tagName.toLowerCase()}${el.className ? '.' + el.className.split(' ').join('.') : ''}${el.id ? '#' + el.id : ''}`);
    
    const contentSections = Array.from(document.querySelectorAll('main, .main, .content, section, [role="main"]'))
      .map(el => `${el.tagName.toLowerCase()}${el.className ? '.' + el.className.split(' ').join('.') : ''}${el.id ? '#' + el.id : ''}`);
    
    const sidebarElements = Array.from(document.querySelectorAll('aside, .sidebar, [role="complementary"]'))
      .map(el => `${el.tagName.toLowerCase()}${el.className ? '.' + el.className.split(' ').join('.') : ''}${el.id ? '#' + el.id : ''}`);
    
    const footerElements = Array.from(document.querySelectorAll('footer, .footer, [role="contentinfo"]'))
      .map(el => `${el.tagName.toLowerCase()}${el.className ? '.' + el.className.split(' ').join('.') : ''}${el.id ? '#' + el.id : ''}`);

    return {
      overall_structure: `Document contains ${headerElements.length} header(s), ${navElements.length} navigation(s), ${contentSections.length} content section(s), ${sidebarElements.length} sidebar(s), and ${footerElements.length} footer(s)`,
      header_elements: headerElements,
      navigation_elements: navElements,
      content_sections: contentSections,
      sidebar_elements: sidebarElements.length ? sidebarElements : undefined,
      footer_elements: footerElements,
      responsive_design: {
        mobile_viewport: this.checkResponsive('mobile'),
        tablet_viewport: this.checkResponsive('tablet'),
        desktop_viewport: this.checkResponsive('desktop')
      }
    };
  }

  private analyzeVisualDesign() {
    const computedStyle = getComputedStyle(document.body);
    
    // Color Analysis
    const backgroundColor = getComputedStyleRgb(document.body, 'background-color') || [255, 255, 255];
    const textColor = getComputedStyleRgb(document.body, 'color') || [0, 0, 0];
    
    const colorScheme = {
      primary_colors: this.extractColors(['button', 'a', '.primary']),
      secondary_colors: this.extractColors(['.secondary', '.accent']),
      accent_colors: this.extractColors(['.highlight', '.emphasis']),
      background_colors: [`rgb(${backgroundColor.join(', ')})`],
      text_colors: [`rgb(${textColor.join(', ')})`],
      contrast_issues: this.checkContrastIssues()
    };
    
    // Typography Analysis
    const typography = {
      fonts_used: this.extractFonts(),
      font_sizes: this.extractFontSizes(),
      line_heights: this.extractLineHeights(),
      text_alignment: this.extractTextAlignment(),
      readability_issues: this.checkReadability()
    };
    
    // Spacing Analysis
    const spacing = {
      margin_inconsistencies: this.checkMarginInconsistencies(),
      padding_issues: this.checkPaddingIssues(),
      layout_gaps: this.identifyLayoutGaps()
    };
    
    return {
      color_scheme: colorScheme,
      typography: typography,
      spacing: spacing
    };
  }

  private analyzeContent() {
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
      .map(h => ({
        level: parseInt(h.tagName.substring(1)),
        text: h.textContent?.substring(0, 100) || '',
        position: `${h.tagName.toLowerCase()}${h.className ? '.' + h.className.split(' ').join('.') : ''}${h.id ? '#' + h.id : ''}`
      }));
    
    const paragraphs = Array.from(document.querySelectorAll('p'))
      .map(p => ({
        length: p.textContent?.length || 0,
        readability_score: this.calculateReadabilityScore(p.textContent || ''),
        position: `p${p.className ? '.' + p.className.split(' ').join('.') : ''}${p.id ? '#' + p.id : ''}`
      }));
    
    const lists = Array.from(document.querySelectorAll('ul, ol, dl'))
      .map(list => ({
        type: list.tagName.toLowerCase(),
        items: list.querySelectorAll('li, dt, dd').length,
        position: `${list.tagName.toLowerCase()}${list.className ? '.' + list.className.split(' ').join('.') : ''}${list.id ? '#' + list.id : ''}`
      }));
    
    const images = Array.from(document.querySelectorAll('img'))
      .map(img => ({
        src: img.src,
        alt_text: img.alt || undefined,
        dimensions: img.width && img.height ? `${img.width}x${img.height}` : undefined,
        accessibility_issue: !img.alt && !img.getAttribute('aria-label') ? 'Missing alt text' : undefined
      }));
    
    const videos = Array.from(document.querySelectorAll('video'))
      .map(video => ({
        src: video.src,
        captions: video.textTracks.length > 0,
        accessibility_issue: video.textTracks.length === 0 ? 'Missing captions' : undefined
      }));
    
    return {
      text_content: {
        headings_structure: headings,
        paragraphs: paragraphs,
        lists: lists
      },
      media_content: {
        images: images,
        videos: videos
      },
      spelling_grammar: this.detectSpellingGrammar()
    };
  }

  private async analyzeAccessibility() {
    const axeLoaded = await loadAxe();
    let wcagViolations: any[] = [];
    let wcagLevel: "A" | "AA" | "AAA" | "Non-compliant" = "A";
    
    if (axeLoaded && (window as any).axe) {
      try {
        const results = await (window as any).axe.run();
        wcagViolations = results.violations;
        
        // Determine WCAG compliance level
        if (wcagViolations.length === 0) {
          wcagLevel = "AAA";
        } else {
          const hasCritical = wcagViolations.some(v => v.impact === 'critical');
          const hasSerious = wcagViolations.some(v => v.impact === 'serious');
          wcagLevel = hasCritical ? "Non-compliant" : hasSerious ? "A" : "AA";
        }
      } catch (error) {
        console.warn('Axe-core analysis failed:', error);
      }
    }
    
    return {
      wcag_compliance: {
        level: wcagLevel,
        violations: wcagViolations.map(v => ({
          guideline: v.tags.find(t => t.startsWith('wcag')) || 'unknown',
          level: v.impact || 'unknown',
          element: v.nodes[0]?.html || 'unknown',
          description: v.description
        }))
      },
      keyboard_navigation: this.analyzeKeyboardNavigation(),
      screen_reader: this.analyzeScreenReaderSupport(),
      visual_accessibility: this.analyzeVisualAccessibility()
    };
  }

  private analyzeTechnicalIssues() {
    const htmlIssues: Array<{line?: number; element: string; issue: string; severity: "error" | "warning" | "info"}> = [];
    
    // Check for missing DOCTYPE
    if (!document.doctype) {
      htmlIssues.push({
        element: 'document',
        issue: 'Missing DOCTYPE declaration',
        severity: 'error'
      });
    }
    
    // Check for missing language attribute
    if (!document.documentElement.lang) {
      htmlIssues.push({
        element: 'html',
        issue: 'Missing lang attribute on html element',
        severity: 'error'
      });
    }
    
    // Check for missing viewport meta tag
    const viewportMeta = document.querySelector('meta[name="viewport"]');
    if (!viewportMeta) {
      htmlIssues.push({
        element: 'head',
        issue: 'Missing viewport meta tag',
        severity: 'warning'
      });
    }
    
    // Performance data (simplified)
    const performance = window.performance;
    let loadTime: number | undefined;
    if (performance && performance.timing) {
      loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
    }
    
    return {
      html_validation: htmlIssues,
      performance: {
        load_time: loadTime,
        resource_sizes: this.analyzeResourceSizes(),
        optimization_opportunities: this.identifyOptimizationOpportunities()
      },
      security: this.analyzeSecurity(),
      javascript_errors: this.captureJavaScriptErrors()
    };
  }

  private analyzeUX() {
    const navLinks = Array.from(document.querySelectorAll('nav a, .navigation a, .menu a'));
    const mainCTA = document.querySelector('.cta, .call-to-action, button[type="submit"]');
    const forms = Array.from(document.querySelectorAll('form'));
    
    return {
      navigation_flow: {
        main_navigation: navLinks.map(link => link.textContent?.substring(0, 50) || ''),
        breadcrumbs: Array.from(document.querySelectorAll('.breadcrumb, .breadcrumbs'))
          .map(bc => bc.textContent?.substring(0, 100) || ''),
        search_functionality: document.querySelector('input[type="search"], .search, #search') 
          ? 'Search functionality present' 
          : 'No search functionality found',
        user_flow_issues: this.identifyUserFlowIssues()
      },
      forms: forms.map(form => ({
        form_name: form.getAttribute('name') || form.id || 'unnamed_form',
        fields: form.querySelectorAll('input, select, textarea').length,
        validation: form.hasAttribute('novalidate') ? 'Client validation disabled' : 'Client validation enabled',
        accessibility_issues: this.checkFormAccessibility(form),
        usability_issues: this.checkFormUsability(form)
      })),
      calls_to_action: mainCTA ? [{
        element: mainCTA.tagName.toLowerCase(),
        text: mainCTA.textContent?.substring(0, 50) || '',
        visibility: this.getElementVisibility(mainCTA),
        accessibility_issue: this.checkCTAAccessibility(mainCTA)
      }] : [],
      loading_states: this.analyzeLoadingStates()
    };
  }

  private analyzeNavigationGuidance() {
    const interactiveElements = Array.from(document.querySelectorAll('a, button, input[type="submit"], input[type="button"], [role="button"]'))
      .map(el => {
        const rect = el.getBoundingClientRect();
        return {
          element: el.tagName.toLowerCase(),
          type: this.getElementType(el),
          selector: this.generateSelector(el),
          text_content: el.textContent?.substring(0, 100),
          aria_label: el.getAttribute('aria-label') || undefined,
          coordinates: rect.width > 0 && rect.height > 0 ? {
            x: Math.round(rect.left + rect.width / 2),
            y: Math.round(rect.top + rect.height / 2)
          } : undefined
        };
      });
    
    const landmarks = [
      'header', 'nav', 'main', 'aside', 'footer', 'section', 'article', 'form', 'search', 'complementary', 'contentinfo', 'banner'
    ].map(landmark => {
      const elements = document.querySelectorAll(`[role="${landmark}"], ${landmark}`);
      return Array.from(elements).map(el => ({
        type: landmark,
        label: el.getAttribute('aria-label') || el.id || undefined,
        selector: this.generateSelector(el),
        description: this.getElementDescription(el)
      }));
    }).flat();
    
    return {
      interactive_elements: interactiveElements,
      page_landmarks: landmarks,
      keyboard_shortcuts: this.detectKeyboardShortcuts()
    };
  }

  private generateSummary(observation: WebObservation) {
    const criticalIssues: string[] = [];
    const fixes: Array<{issue: string; priority: "critical" | "high" | "medium" | "low"; solution: string}> = [];
    const positive: string[] = [];
    
    // Analyze critical issues
    if (observation.accessibility.wcag_compliance.violations.length > 0) {
      criticalIssues.push(`${observation.accessibility.wcag_compliance.violations.length} WCAG violations detected`);
    }
    
    if (observation.content_analysis.media_content.images.some(img => img.accessibility_issue)) {
      criticalIssues.push('Images missing alt text');
    }
    
    if (observation.technical_issues.html_validation.some(issue => issue.severity === 'error')) {
      criticalIssues.push('HTML validation errors detected');
    }
    
    // Generate fixes
    observation.content_analysis.media_content.images
      .filter(img => img.accessibility_issue)
      .forEach(img => {
        fixes.push({
          issue: 'Missing alt text for image',
          priority: 'high',
          solution: `Add descriptive alt text to image: ${img.src}`
        });
      });
    
    // Positive aspects
    if (observation.accessibility.wcag_compliance.level === 'AA' || observation.accessibility.wcag_compliance.level === 'AAA') {
      positive.push('Good WCAG compliance level achieved');
    }
    
    if (observation.layout.navigation_elements.length > 0) {
      positive.push('Clear navigation structure present');
    }
    
    // Calculate overall score (simplified)
    let score = 100;
    score -= criticalIssues.length * 10;
    score -= fixes.filter(f => f.priority === 'high').length * 5;
    score -= fixes.filter(f => f.priority === 'medium').length * 2;
    score -= fixes.filter(f => f.priority === 'low').length * 1;
    score = Math.max(0, Math.min(100, score));
    
    return {
      overall_score: score,
      critical_issues: criticalIssues,
      recommended_fixes: fixes,
      positive_aspects: positive
    };
  }

  // Helper methods (simplified implementations)
  private checkResponsive(viewport: 'mobile' | 'tablet' | 'desktop'): string {
    const width = window.innerWidth;
    if (viewport === 'mobile' && width < 768) return 'Responsive elements detected';
    if (viewport === 'tablet' && width >= 768 && width < 1024) return 'Responsive elements detected';
    if (viewport === 'desktop' && width >= 1024) return 'Responsive elements detected';
    return 'Viewport not active';
  }
  
  private extractColors(selectors: string[]): string[] {
    // Simplified color extraction
    return ['#000000', '#ffffff']; // Placeholder
  }
  
  private checkContrastIssues() {
    return [
      {
        element: 'body',
        issue: 'Insufficient contrast ratio',
        wcag_level: 'AA'
      }
    ]; // Placeholder
  }
  
  private extractFonts(): string[] {
    const fonts = new Set<string>();
    const elements = document.querySelectorAll('*');
    elements.forEach(el => {
      const fontFamily = window.getComputedStyle(el).fontFamily;
      if (fontFamily && fontFamily !== 'initial') {
        fonts.add(fontFamily);
      }
    });
    return Array.from(fonts);
  }
  
  private extractFontSizes() {
    return [
      { element: 'body', size: '16px', unit: 'px' }
    ]; // Placeholder
  }
  
  private extractLineHeights() {
    return [
      { element: 'body', ratio: 1.5 }
    ]; // Placeholder
  }
  
  private extractTextAlignment() {
    return [
      { element: 'body', alignment: 'left' }
    ]; // Placeholder
  }
  
  private checkReadability(): string[] {
    return []; // Placeholder
  }
  
  private checkMarginInconsistencies() {
    return []; // Placeholder
  }
  
  private checkPaddingIssues() {
    return []; // Placeholder
  }
  
  private identifyLayoutGaps() {
    return []; // Placeholder
  }
  
  private calculateReadabilityScore(text: string): number {
    // Simplified readability score
    return Math.min(100, Math.max(0, 100 - text.length / 10));
  }
  
  private detectSpellingGrammar() {
    return []; // Placeholder
  }
  
  private analyzeKeyboardNavigation() {
    return {
      tab_order_issues: [],
      focus_indicators: [
        { element: 'button', visible: true }
      ],
      skip_links: []
    }; // Placeholder
  }
  
  private analyzeScreenReaderSupport() {
    return {
      aria_labels: [
        { element: 'button', label: 'Submit', issue: undefined }
      ],
      heading_structure: ['Proper heading hierarchy'],
      landmark_elements: ['main', 'navigation'],
      form_labels: [
        { element: 'input', label: 'Email', issue: undefined }
      ]
    }; // Placeholder
  }
  
  private analyzeVisualAccessibility() {
    return {
      color_contrast: [
        { element: 'text', ratio: 4.5, passes: true }
      ],
      text_scaling: ['Text scaling supported'],
      flashing_content: []
    }; // Placeholder
  }
  
  private analyzeResourceSizes() {
    return [
      { resource: 'styles.css', size: '50KB' }
    ]; // Placeholder
  }
  
  private identifyOptimizationOpportunities() {
    return []; // Placeholder
  }
  
  private analyzeSecurity() {
    return {
      https_status: window.location.protocol === 'https:' ? 'secure' : 'insecure',
      mixed_content: [],
      security_headers: [
        { header: 'X-Frame-Options', present: false }
      ]
    };
  }
  
  private captureJavaScriptErrors() {
    return []; // Placeholder
  }
  
  private identifyUserFlowIssues() {
    return []; // Placeholder
  }
  
  private checkFormAccessibility(form: Element): string[] {
    return []; // Placeholder
  }
  
  private checkFormUsability(form: Element): string[] {
    return []; // Placeholder
  }
  
  private getElementVisibility(element: Element): string {
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' ? 'visible' : 'hidden';
  }
  
  private checkCTAAccessibility(element: Element): string | undefined {
    return undefined; // Placeholder
  }
  
  private analyzeLoadingStates() {
    return [
      { element: 'button', loading_indicator: false, user_feedback: 'No loading state' }
    ]; // Placeholder
  }
  
  private getElementType(element: Element): string {
    const tagName = element.tagName.toLowerCase();
    if (tagName === 'a') return 'link';
    if (tagName === 'button' || element.getAttribute('role') === 'button') return 'button';
    if (tagName === 'input') {
      const type = (element as HTMLInputElement).type;
      return type === 'submit' || type === 'button' ? 'button' : type;
    }
    return tagName;
  }
  
  private generateSelector(element: Element): string {
    if (element.id) return `#${element.id}`;
    if (element.className) return `.${element.className.split(' ').join('.')}`;
    return element.tagName.toLowerCase();
  }
  
  private getElementDescription(element: Element): string {
    const text = element.textContent?.substring(0, 100);
    return text || `${element.tagName.toLowerCase()} element`;
  }
  
  private detectKeyboardShortcuts() {
    return [
      { action: 'Submit', keys: 'Enter', description: 'Submit form or activate button' }
    ]; // Placeholder
  }
}