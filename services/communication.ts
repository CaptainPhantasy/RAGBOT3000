import type { WebObservation } from "../memory/types";

export interface CommunicationChannel {
	// Output channel for observations
	broadcast(observation: WebObservation): void;

	// Input channel for commands/queries
	receive(message: CommunicationMessage): Promise<void>;
}

export interface CommunicationMessage {
	id: string;
	type: "query" | "command" | "navigation" | "analysis_request";
	content: string | Record<string, any>;
	timestamp: number;
	source: "llm" | "human" | "system";
}

export interface LLMResponse {
	observations: WebObservation;
	navigation_guidance: {
		interactive_elements: Array<{
			element: string;
			type: string;
			selector: string;
			coordinates?: { x: number; y: number };
		}>;
		current_focus: string;
		suggested_actions: Array<{
			action: string;
			target: string;
			description: string;
		}>;
	};
}

// Communication output format for LLM consumption
export class OutputChannel {
	public readonly observers: Array<(data: string) => void> = [];

	// Register observers (could be console, file, websocket, etc.)
	public registerObserver(callback: (data: string) => void): void {
		this.observers.push(callback);
	}

	// Broadcast observations to all registered observers
	public broadcast(observation: WebObservation): void {
		const output = this.formatForLLM(observation);
		this.observers.forEach((observer) => observer(output));
	}

	// Format observation for LLM consumption
	private formatForLLM(observation: WebObservation): string {
		return JSON.stringify(
			{
				type: "web_analysis",
				timestamp: observation.timestamp,
				url: observation.url,
				page_title: observation.page_title,

				// Critical information first
				critical_issues: observation.summary.critical_issues,
				overall_score: observation.summary.overall_score,
				wcag_level: observation.accessibility.wcag_compliance.level,

				// Navigation guidance for interaction
				navigation_guidance: {
					interactive_elements:
						observation.navigation_guidance.interactive_elements.map((el) => ({
							element: el.element,
							type: el.type,
							selector: el.selector,
							coordinates: el.coordinates,
							text_content: el.text_content,
							aria_label: el.aria_label,
						})),
					current_focus: this.getCurrentFocus(),
					suggested_actions: this.generateSuggestedActions(observation),
				},

				// Detailed analysis
				detailed_analysis: {
					layout: observation.layout,
					accessibility: {
						violations: observation.accessibility.wcag_compliance.violations,
						keyboard_issues:
							observation.accessibility.keyboard_navigation.tab_order_issues,
						contrast_issues:
							observation.accessibility.visual_accessibility.color_contrast.filter(
								(c) => !c.passes,
							),
					},
					css: {
						layout_systems: observation.css_analysis.layout_systems,
						performance_issues:
							observation.css_analysis.potential_issues.performance_impact,
						responsive:
							observation.css_analysis.responsive_behavior.breakpoint_analysis,
					},
					content: {
						images_without_alt:
							observation.content_analysis.media_content.images.filter(
								(img) => img.accessibility_issue,
							),
						forms: observation.ux_assessment.forms,
						calls_to_action: observation.ux_assessment.calls_to_action,
					},
					technical: {
						html_issues: observation.technical_issues.html_validation,
						performance: observation.technical_issues.performance,
						security: observation.technical_issues.security,
					},
				},

				// Recommended fixes
				recommended_fixes: observation.summary.recommended_fixes,

				// Positive aspects for context
				positive_aspects: observation.summary.positive_aspects,
			},
			null,
			2,
		);
	}

	private getCurrentFocus(): string {
		const activeElement = document.activeElement;
		if (!activeElement || activeElement === document.body) {
			return "No element currently focused";
		}
		return this.generateSelector(activeElement);
	}

	private generateSuggestedActions(
		observation: WebObservation,
	): Array<{ action: string; target: string; description: string }> {
		const actions = [];

		// Suggest fixing critical accessibility issues
		observation.summary.critical_issues.forEach((issue) => {
			actions.push({
				action: "fix_accessibility",
				target: "critical_issues",
				description: `Fix critical issue: ${issue}`,
			});
		});

		// Suggest navigation improvements
		if (
			observation.accessibility.keyboard_navigation.tab_order_issues.length > 0
		) {
			actions.push({
				action: "improve_navigation",
				target: "keyboard_order",
				description: "Fix keyboard tab order issues",
			});
		}

		// Suggest form improvements
		observation.ux_assessment.forms.forEach((form) => {
			if (form.accessibility_issues.length > 0) {
				actions.push({
					action: "fix_form",
					target: form.form_name,
					description: `Improve form accessibility: ${form.accessibility_issues.join(", ")}`,
				});
			}
		});

		return actions;
	}

	private generateSelector(element: Element): string {
		if (element.id) return `#${element.id}`;
		if (element.className) return `.${element.className.split(" ").join(".")}`;
		return element.tagName.toLowerCase();
	}
}

// Communication input handler
export class InputChannel {
	private handlers: Map<
		string,
		(message: CommunicationMessage) => Promise<void>
	> = new Map();

	// Register handlers for different message types
	public registerHandler(
		type: string,
		handler: (message: CommunicationMessage) => Promise<void>,
	): void {
		this.handlers.set(type, handler);
	}

	// Receive and process messages
	public async receive(message: CommunicationMessage): Promise<void> {
		const handler = this.handlers.get(message.type);
		if (handler) {
			await handler(message);
		} else {
			console.warn(`No handler registered for message type: ${message.type}`);
		}
	}

	// Parse incoming text into a structured message
	public parseIncoming(
		text: string,
		source: "llm" | "human" = "llm",
	): CommunicationMessage | null {
		try {
			// Try to parse as JSON first
			if (text.startsWith("{") || text.startsWith("[")) {
				const parsed = JSON.parse(text);
				return {
					id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
					type: parsed.type || "command",
					content: parsed.content || parsed,
					timestamp: Date.now(),
					source,
				};
			}

			// Parse natural language commands
			const lowerText = text.toLowerCase();
			let type: CommunicationMessage["type"] = "query";
			let content = text;

			if (
				lowerText.includes("click") ||
				lowerText.includes("navigate") ||
				lowerText.includes("scroll")
			) {
				type = "command";
			} else if (lowerText.includes("analyze") || lowerText.includes("check")) {
				type = "analysis_request";
			}

			return {
				id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
				type,
				content,
				timestamp: Date.now(),
				source,
			};
		} catch (error) {
			console.error("Failed to parse incoming message:", error);
			return null;
		}
	}
}

// Communication manager that coordinates input/output
export class CommunicationManager implements CommunicationChannel {
	private outputChannel: OutputChannel;
	private inputChannel: InputChannel;
	private isListening = false;

	constructor() {
		this.outputChannel = new OutputChannel();
		this.inputChannel = new InputChannel();

		// Setup default handlers
		this.setupDefaultHandlers();

		// Start listening for input
		this.startListening();
	}

	public broadcast(observation: WebObservation): void {
		this.outputChannel.broadcast(observation);
	}

	public async receive(message: CommunicationMessage): Promise<void> {
		await this.inputChannel.receive(message);
	}

	private setupDefaultHandlers(): void {
		// Handle commands
		this.inputChannel.registerHandler("command", async (message) => {
			await this.handleCommand(message);
		});

		// Handle queries
		this.inputChannel.registerHandler("query", async (message) => {
			await this.handleQuery(message);
		});

		// Handle analysis requests
		this.inputChannel.registerHandler("analysis_request", async (message) => {
			await this.handleAnalysisRequest(message);
		});
	}

	private async handleCommand(message: CommunicationMessage): Promise<void> {
		const content =
			typeof message.content === "string"
				? this.parseCommand(message.content)
				: message.content;

		console.log(`[COMMAND] Executing: ${JSON.stringify(content)}`);

		// Here you would execute the actual command
		// For now, just log it
		const result = await this.executeCommand(content);

		// Send response
		this.outputChannel.observers.forEach((observer) => {
			observer(
				JSON.stringify({
					type: "command_response",
					command: content,
					result,
					timestamp: Date.now(),
				}),
			);
		});
	}

	private async handleQuery(message: CommunicationMessage): Promise<void> {
		console.log(`[QUERY] Received: ${message.content}`);

		// Process query and generate response
		const response = await this.processQuery(message.content as string);

		// Send response
		this.outputChannel.observers.forEach((observer) => {
			observer(
				JSON.stringify({
					type: "query_response",
					query: message.content,
					response,
					timestamp: Date.now(),
				}),
			);
		});
	}

	private async handleAnalysisRequest(
		message: CommunicationMessage,
	): Promise<void> {
		console.log(`[ANALYSIS] Request: ${message.content}`);

		// Trigger analysis
		const { WebAnalyzer } = await import("../services/webAnalyzer");
		const analyzer = new WebAnalyzer();
		const observation = await analyzer.analyzeCurrentPage();

		// Broadcast the observation
		this.broadcast(observation);
	}

	private parseCommand(text: string): Record<string, any> {
		const lower = text.toLowerCase();

		// Parse click commands
		if (lower.includes("click")) {
			const match = text.match(/click\s+(.+?)(?:\s|$)/i);
			return {
				action: "click",
				target: match ? match[1] : "unknown",
			};
		}

		// Parse navigate commands
		if (lower.includes("navigate")) {
			const match = text.match(/navigate\s+(.+?)(?:\s|$)/i);
			return {
				action: "navigate",
				url: match ? match[1] : "",
			};
		}

		// Parse scroll commands
		if (lower.includes("scroll")) {
			const match = text.match(/scroll\s+(.+?)(?:\s|$)/i);
			return {
				action: "scroll",
				target: match ? match[1] : "top",
			};
		}

		return { action: "unknown", raw: text };
	}

	private async executeCommand(command: Record<string, any>): Promise<any> {
		switch (command.action) {
			case "click":
				return await this.executeClick(command.target);
			case "navigate":
				return await this.executeNavigate(command.url);
			case "scroll":
				return await this.executeScroll(command.target);
			default:
				return { error: "Unknown command", command };
		}
	}

	private async executeClick(target: string): Promise<any> {
		try {
			const element = document.querySelector(target);
			if (element) {
				(element as HTMLElement).click();
				return { success: true, element: target };
			}
			return { error: "Element not found", target };
		} catch (error) {
			return {
				error: error instanceof Error ? error.message : "Unknown error",
				target,
			};
		}
	}

	private async executeNavigate(url: string): Promise<any> {
		if (!url) {
			return { error: "URL required for navigation" };
		}
		window.location.href = url;
		return { success: true, url };
	}

	private async executeScroll(target: string): Promise<any> {
		try {
			let element: Element | null = null;

			if (target === "top") {
				window.scrollTo(0, 0);
				return { success: true, target: "top of page" };
			} else if (target === "bottom") {
				window.scrollTo(0, document.body.scrollHeight);
				return { success: true, target: "bottom of page" };
			} else {
				element = document.querySelector(target);
				if (element) {
					element.scrollIntoView({ behavior: "smooth" });
					return { success: true, element: target };
				}
			}

			return { error: "Scroll target not found", target };
		} catch (error) {
			return {
				error: error instanceof Error ? error.message : "Unknown error",
				target,
			};
		}
	}

	private async processQuery(query: string): Promise<string> {
		const latest = await this.getLatestObservation();

		if (!latest) {
			return "No analysis available. Please run an analysis first.";
		}

		const lowerQuery = query.toLowerCase();

		if (lowerQuery.includes("accessibility") || lowerQuery.includes("wcag")) {
			return `WCAG Level: ${latest.accessibility.wcag_compliance.level}. Violations: ${latest.accessibility.wcag_compliance.violations.length}. Critical issues: ${latest.summary.critical_issues.length}.`;
		}

		if (lowerQuery.includes("css") || lowerQuery.includes("style")) {
			return `Layout systems: ${latest.css_analysis.layout_systems.flexbox.containers.length} flexbox, ${latest.css_analysis.layout_systems.grid.containers.length} grid. CSS issues: ${latest.css_analysis.potential_issues.performance_impact.length}.`;
		}

		if (lowerQuery.includes("error") || lowerQuery.includes("issue")) {
			return `Critical issues: ${latest.summary.critical_issues.length}. HTML issues: ${latest.technical_issues.html_validation.length}. JS errors: ${latest.technical_issues.javascript_errors.length}.`;
		}

		return `Page score: ${latest.summary.overall_score}/100. ${latest.summary.positive_aspects.join(". ")}`;
	}

	private async getLatestObservation() {
		const { getMemoryManager } = await import("../memory/memoryManager");
		const memoryManager = getMemoryManager();
		return memoryManager.getLatestObservation();
	}

	private startListening(): void {
		if (this.isListening) return;

		this.isListening = true;

		// Listen for input from various sources
		// This could be websocket, server-sent events, or polling

		// For now, set up a simple text input listener
		// In production, this would be replaced with proper API endpoints

		// Register console as an output observer
		this.outputChannel.registerObserver((data: string) => {
			console.log("[OUTPUT]", data);
		});
	}

	// Public API for external integration
	public getInputChannel(): InputChannel {
		return this.inputChannel;
	}

	public getOutputChannel(): OutputChannel {
		return this.outputChannel;
	}
}
