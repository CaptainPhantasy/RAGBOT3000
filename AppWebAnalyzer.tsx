import React, { useEffect, useState } from "react";
import { WebAnalyzer } from "./services/webAnalyzer";
import { MarkdownCommunication } from "./services/markdownCommunication";

const App: React.FC = () => {
	const [status, setStatus] = useState<string>("Initializing...");
	const [lastAnalysis, setLastAnalysis] = useState<string | null>(null);

	const webAnalyzer = new WebAnalyzer();
	const markdownComms = new MarkdownCommunication();

	// Initialize and start watching for commands
	useEffect(() => {
		const initialize = async () => {
			setStatus("Analyzing current page...");

			try {
				// Analyze the current page
				const observation = await webAnalyzer.analyzeCurrentPage();
				setLastAnalysis(
					`Analysis complete at ${new Date(observation.timestamp).toLocaleString()}`,
				);
				setStatus("Ready - Watching for commands");

				// Start watching for commands from LLM
				markdownComms.startWatching(async (command) => {
					setStatus(
						`Processing command: ${command.action} on ${command.target}`,
					);

					let result;
					try {
						// Execute the command
						switch (command.action) {
							case "click_element":
								result = await executeClick(command.target);
								break;
							case "navigate_to":
								result = await executeNavigate(command.target);
								break;
							case "scroll_to":
								result = await executeScroll(command.target);
								break;
							case "extract_text":
								result = await extractText(command.target);
								break;
							case "analyze_element":
								result = await analyzeElement(
									command.target,
									command.parameters,
								);
								break;
							case "wait_for_element":
								result = await waitForElement(
									command.target,
									command.parameters,
								);
								break;
							default:
								result = { error: "Unknown command" };
						}

						// Mark command as processed
						markdownComms.markCommandProcessed(command.id, result);

						// Re-analyze after command execution
						setTimeout(async () => {
							setStatus("Re-analyzing page...");
							await webAnalyzer.analyzeCurrentPage();
							setLastAnalysis(
								`Re-analysis complete at ${new Date().toLocaleString()}`,
							);
							setStatus("Ready - Watching for commands");
						}, 1000);
					} catch (error) {
						const errorMsg =
							error instanceof Error ? error.message : "Unknown error";
						markdownComms.markCommandProcessed(command.id, { error: errorMsg });
						setStatus(`Error: ${errorMsg}`);
					}
				});
			} catch (error) {
				const errorMsg =
					error instanceof Error ? error.message : "Unknown error";
				setStatus(`Initialization failed: ${errorMsg}`);
			}
		};

		initialize();
	}, []);

	// Command execution functions
	const executeClick = async (selector: string) => {
		const element = document.querySelector(selector);
		if (element) {
			(element as HTMLElement).click();
			return { success: true, element: selector };
		}
		return { error: "Element not found", selector };
	};

	const executeNavigate = async (url: string) => {
		if (!url) {
			return { error: "URL required for navigation" };
		}
		window.location.href = url;
		return { success: true, url };
	};

	const executeScroll = async (target: string) => {
		if (target === "top") {
			window.scrollTo(0, 0);
			return { success: true, target: "top of page" };
		} else if (target === "bottom") {
			window.scrollTo(0, document.body.scrollHeight);
			return { success: true, target: "bottom of page" };
		} else {
			const element = document.querySelector(target);
			if (element) {
				element.scrollIntoView({ behavior: "smooth" });
				return { success: true, element: target };
			}
			return { error: "Scroll target not found", target };
		}
	};

	const extractText = async (selector: string) => {
		const elements = document.querySelectorAll(selector);
		if (elements.length === 0) {
			return { error: "No elements found", selector };
		}

		const texts = Array.from(elements).map((el) => ({
			element: selector,
			text: el.textContent?.trim() || "",
			visible: isVisible(el),
		}));

		return { success: true, texts };
	};

	const analyzeElement = async (selector: string, parameters?: any) => {
		const element = document.querySelector(selector);
		if (!element) {
			return { error: "Element not found", selector };
		}

		const style = window.getComputedStyle(element);
		const rect = element.getBoundingClientRect();

		const result: any = {
			element: selector,
			tag: element.tagName.toLowerCase(),
			id: element.id || null,
			classes: Array.from(element.classList),
			text: element.textContent?.trim() || "",
			visible: isVisible(element),
			position: {
				x: Math.round(rect.left),
				y: Math.round(rect.top),
				width: Math.round(rect.width),
				height: Math.round(rect.height),
			},
		};

		if (parameters?.include_styles) {
			result.styles = {
				display: style.display,
				position: style.position,
				color: style.color,
				backgroundColor: style.backgroundColor,
				fontSize: style.fontSize,
				fontFamily: style.fontFamily,
			};
		}

		if (parameters?.include_accessibility) {
			result.accessibility = {
				ariaLabel: element.getAttribute("aria-label"),
				ariaRole: element.getAttribute("role"),
				tabIndex: element.getAttribute("tabindex"),
				hasAlt:
					element.tagName.toLowerCase() === "img"
						? element.hasAttribute("alt")
						: null,
			};
		}

		return { success: true, analysis: result };
	};

	const waitForElement = async (selector: string, parameters?: any) => {
		const timeout = parameters?.timeout || 5000;
		const startTime = Date.now();

		return new Promise((resolve) => {
			const checkInterval = setInterval(() => {
				const element = document.querySelector(selector);
				if (element) {
					clearInterval(checkInterval);
					resolve({
						success: true,
						element: selector,
						wait_time: Date.now() - startTime,
					});
				} else if (Date.now() - startTime > timeout) {
					clearInterval(checkInterval);
					resolve({
						error: `Element ${selector} not found within ${timeout}ms`,
						element: selector,
					});
				}
			}, 100);
		});
	};

	const isVisible = (element: Element): boolean => {
		const style = window.getComputedStyle(element);
		const rect = element.getBoundingClientRect();

		return (
			style.display !== "none" &&
			style.visibility !== "hidden" &&
			style.opacity !== "0" &&
			rect.width > 0 &&
			rect.height > 0
		);
	};

	return (
		<div className="fixed bottom-4 right-4 bg-white p-4 rounded-lg shadow-lg border max-w-sm">
			<h3 className="font-bold text-lg mb-2">RAGBOT Web Analyzer</h3>

			<div className="space-y-2 text-sm">
				<div className="flex items-center">
					<div
						className={`w-3 h-3 rounded-full mr-2 ${
							status.includes("Ready")
								? "bg-green-500"
								: status.includes("Processing")
									? "bg-yellow-500"
									: "bg-red-500"
						}`}
					></div>
					<span className="text-gray-700">Status:</span>
					<span className="ml-1 font-medium">{status}</span>
				</div>

				{lastAnalysis && (
					<div className="text-gray-600">Last: {lastAnalysis}</div>
				)}

				<div className="text-xs text-gray-500 pt-2 border-t">
					Observations: /Volumes/Storage/Knowledge Bases/RAGBOT_OBSERVATIONS.md
					<br />
					Commands: /Volumes/Storage/Knowledge Bases/RAGBOT_COMMANDS.md
				</div>
			</div>
		</div>
	);
};

export default App;
