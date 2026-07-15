// Enhanced CSS Analyzer module for detailed style extraction
export interface CSSAnalysis {
	computed_styles: {
		element_selector: string;
		styles: Record<string, string>;
		specificity: number;
		inherited: string[];
	}[];
	custom_properties: {
		name: string;
		value: string;
		scope: "root" | "element";
		usage_count: number;
	}[];
	layout_systems: {
		flexbox: {
			containers: string[];
			items: string[];
			issues: string[];
		};
		grid: {
			containers: string[];
			items: string[];
			tracks: Array<{ direction: string; size: string }>;
			issues: string[];
		};
	};
	responsive_behavior: {
		media_queries: Array<{ query: string; styles_affected: number }>;
		breakpoint_analysis: {
			current_viewport: string;
			active_breakpoints: string[];
			layout_shifts: string[];
		};
	};
	animation_transitions: {
		animations: Array<{ name: string; duration: string; elements: string[] }>;
		transitions: Array<{
			property: string;
			duration: string;
			elements: string[];
		}>;
	};
	potential_issues: {
		unused_selectors: string[];
		specificity_conflicts: Array<{ selector: string; conflict_type: string }>;
		performance_impact: Array<{ property: string; impact: string }>;
	};
}

export class CSSAnalyzer {
	private elementsCache = new Map<Element, CSSStyleDeclaration>();

	// Extract all relevant CSS information from the page
	analyzeCSS(): CSSAnalysis {
		console.log("[CSS-ANALYZER] Starting comprehensive CSS analysis");

		return {
			computed_styles: this.extractComputedStyles(),
			custom_properties: this.analyzeCustomProperties(),
			layout_systems: this.analyzeLayoutSystems(),
			responsive_behavior: this.analyzeResponsiveBehavior(),
			animation_transitions: this.analyzeAnimationsAndTransitions(),
			potential_issues: this.identifyCSSIssues(),
		};
	}

	private extractComputedStyles() {
		const elements = document.querySelectorAll("*");
		const computedStyles: CSSAnalysis["computed_styles"] = [];

		elements.forEach((element) => {
			const style = window.getComputedStyle(element);
			const selector = this.generateDetailedSelector(element);
			const specificity = this.calculateSpecificity(selector);

			// Extract only relevant properties
			const relevantStyles: Record<string, string> = {};
			const relevantProperties = [
				"display",
				"position",
				"width",
				"height",
				"margin",
				"padding",
				"border",
				"color",
				"background",
				"font",
				"text",
				"flex",
				"grid",
				"transform",
				"transition",
				"animation",
				"z-index",
				"overflow",
				"visibility",
			];

			relevantProperties.forEach((prop) => {
				Array.from(style).forEach((cssProp) => {
					if (cssProp.startsWith(prop) && style.getPropertyValue(cssProp)) {
						relevantStyles[cssProp] = style.getPropertyValue(cssProp);
					}
				});
			});

			// Get inherited properties
			const inherited: string[] = [];
			if (element.parentElement) {
				const parentStyle = window.getComputedStyle(element.parentElement);
				["font-family", "font-size", "line-height", "color"].forEach((prop) => {
					if (
						style.getPropertyValue(prop) === parentStyle.getPropertyValue(prop)
					) {
						inherited.push(prop);
					}
				});
			}

			computedStyles.push({
				element_selector: selector,
				styles: relevantStyles,
				specificity,
				inherited,
			});
		});

		return computedStyles.filter((s) => Object.keys(s.styles).length > 0);
	}

	private analyzeCustomProperties() {
		const rootStyle = getComputedStyle(document.documentElement);
		const customProps: CSSAnalysis["custom_properties"] = [];

		// Check root level variables
		Array.from(rootStyle).forEach((prop) => {
			if (prop.startsWith("--")) {
				customProps.push({
					name: prop,
					value: rootStyle.getPropertyValue(prop).trim(),
					scope: "root",
					usage_count: this.countCustomPropertyUsage(prop),
				});
			}
		});

		// Check element level variables
		document.querySelectorAll("*").forEach((element) => {
			const style = getComputedStyle(element);
			Array.from(style).forEach((prop) => {
				if (
					prop.startsWith("--") &&
					!customProps.find((cp) => cp.name === prop)
				) {
					customProps.push({
						name: prop,
						value: style.getPropertyValue(prop).trim(),
						scope: "element",
						usage_count: this.countCustomPropertyUsage(prop),
					});
				}
			});
		});

		return customProps;
	}

	private analyzeLayoutSystems() {
		return {
			flexbox: this.analyzeFlexbox(),
			grid: this.analyzeGrid(),
		};
	}

	private analyzeFlexbox() {
		const flexContainers = Array.from(document.querySelectorAll("*")).filter(
			(el) => {
				const style = getComputedStyle(el);
				return style.display === "flex" || style.display === "inline-flex";
			},
		);

		const flexItems = flexContainers.flatMap((container) =>
			Array.from(container.children).map((child) =>
				this.generateDetailedSelector(child),
			),
		);

		const issues: string[] = [];
		flexContainers.forEach((container) => {
			const style = getComputedStyle(container);
			if (style.flexDirection === "row" && style.width === "0px") {
				issues.push(
					`Flex container ${this.generateDetailedSelector(container)} has zero width with row direction`,
				);
			}
		});

		return {
			containers: flexContainers.map((el) => this.generateDetailedSelector(el)),
			items: flexItems,
			issues,
		};
	}

	private analyzeGrid() {
		const gridContainers = Array.from(document.querySelectorAll("*")).filter(
			(el) => {
				const style = getComputedStyle(el);
				return style.display === "grid" || style.display === "inline-grid";
			},
		);

		const gridItems = gridContainers.flatMap((container) =>
			Array.from(container.children).map((child) =>
				this.generateDetailedSelector(child),
			),
		);

		const tracks: Array<{ direction: string; size: string }> = [];
		gridContainers.forEach((container) => {
			const style = getComputedStyle(container);
			const gridTemplateColumns = style.gridTemplateColumns;
			const gridTemplateRows = style.gridTemplateRows;

			if (gridTemplateColumns && gridTemplateColumns !== "none") {
				tracks.push({ direction: "columns", size: gridTemplateColumns });
			}
			if (gridTemplateRows && gridTemplateRows !== "none") {
				tracks.push({ direction: "rows", size: gridTemplateRows });
			}
		});

		const issues: string[] = [];
		gridContainers.forEach((container) => {
			const style = getComputedStyle(container);
			if (
				style.gridTemplateColumns === "none" &&
				style.gridTemplateRows === "none"
			) {
				issues.push(
					`Grid container ${this.generateDetailedSelector(container)} has no explicit tracks defined`,
				);
			}
		});

		return {
			containers: gridContainers.map((el) => this.generateDetailedSelector(el)),
			items: gridItems,
			tracks,
			issues,
		};
	}

	private analyzeResponsiveBehavior() {
		const styleSheets = Array.from(document.styleSheets);
		const mediaQueries: Array<{ query: string; styles_affected: number }> = [];

		styleSheets.forEach((sheet) => {
			try {
				const rules = Array.from(sheet.cssRules || []);
				rules.forEach((rule) => {
					if (rule.type === CSSRule.MEDIA_RULE) {
						const mediaRule = rule as CSSMediaRule;
						const styleCount = Array.from(mediaRule.cssRules).length;
						mediaQueries.push({
							query: mediaRule.media.mediaText,
							styles_affected: styleCount,
						});
					}
				});
			} catch (e) {
				console.warn("Could not access stylesheet rules:", e);
			}
		});

		// Current viewport analysis
		const width = window.innerWidth;
		const height = window.innerHeight;
		let currentViewport = "mobile";
		if (width >= 1024) currentViewport = "desktop";
		else if (width >= 768) currentViewport = "tablet";

		const activeBreakpoints = mediaQueries
			.filter((mq) => this.matchesMediaQuery(mq.query))
			.map((mq) => mq.query);

		return {
			media_queries: mediaQueries,
			breakpoint_analysis: {
				current_viewport: `${currentViewport} (${width}x${height})`,
				active_breakpoints: activeBreakpoints,
				layout_shifts: this.detectLayoutShifts(),
			},
		};
	}

	private analyzeAnimationsAndTransitions() {
		const animations: Array<{
			name: string;
			duration: string;
			elements: string[];
		}> = [];
		const transitions: Array<{
			property: string;
			duration: string;
			elements: string[];
		}> = [];

		document.querySelectorAll("*").forEach((element) => {
			const style = getComputedStyle(element);

			// Extract animations
			if (style.animationName !== "none") {
				const animationNames = style.animationName
					.split(",")
					.map((n) => n.trim());
				const durations = style.animationDuration
					.split(",")
					.map((d) => d.trim());

				animationNames.forEach((name, index) => {
					if (name && name !== "none") {
						animations.push({
							name,
							duration: durations[index] || "0s",
							elements: [this.generateDetailedSelector(element)],
						});
					}
				});
			}

			// Extract transitions
			if (
				style.transitionProperty !== "all" &&
				style.transitionProperty !== "none"
			) {
				const properties = style.transitionProperty
					.split(",")
					.map((p) => p.trim());
				const durations = style.transitionDuration
					.split(",")
					.map((d) => d.trim());

				properties.forEach((property, index) => {
					if (property) {
						transitions.push({
							property,
							duration: durations[index] || "0s",
							elements: [this.generateDetailedSelector(element)],
						});
					}
				});
			}
		});

		return { animations, transitions };
	}

	private identifyCSSIssues() {
		const unusedSelectors = this.findUnusedSelectors();
		const specificityConflicts = this.findSpecificityConflicts();
		const performanceImpact = this.identifyPerformanceIssues();

		return {
			unused_selectors: unusedSelectors,
			specificity_conflicts: specificityConflicts,
			performance_impact: performanceImpact,
		};
	}

	private countCustomPropertyUsage(propName: string): number {
		let count = 0;
		document.querySelectorAll("*").forEach((element) => {
			const style = getComputedStyle(element);
			Array.from(style).forEach((cssProp) => {
				if (cssProp.includes("var(") && cssProp.includes(propName)) {
					count++;
				}
			});
		});
		return count;
	}

	private generateDetailedSelector(element: Element): string {
		const path: string[] = [];
		let current = element;

		while (current.parentElement) {
			let selector = current.tagName.toLowerCase();

			if (current.id) {
				selector += `#${current.id}`;
				path.unshift(selector);
				break; // ID is unique, we can stop here
			}

			const classes = Array.from(current.classList)
				.filter((cls) => !cls.includes("hover") && !cls.includes("active"))
				.slice(0, 2); // Limit classes for readability

			if (classes.length > 0) {
				selector += "." + classes.join(".");
			}

			// Add nth-child if no class/id
			if (!current.id && classes.length === 0) {
				const siblings = Array.from(current.parentElement.children);
				const index = siblings.indexOf(current) + 1;
				selector += `:nth-child(${index})`;
			}

			path.unshift(selector);
			current = current.parentElement;
		}

		return path.join(" > ");
	}

	private calculateSpecificity(selector: string): number {
		const ids = (selector.match(/#/g) || []).length * 100;
		const classes = (selector.match(/\./g) || []).length * 10;
		const elements = (selector.match(/^[a-z]| > [a-z]/g) || []).length;
		return ids + classes + elements;
	}

	private matchesMediaQuery(query: string): boolean {
		return window.matchMedia(query).matches;
	}

	private detectLayoutShifts(): string[] {
		const shifts: string[] = [];
		// Simple detection of common layout shift patterns
		const elements = document.querySelectorAll("*");
		elements.forEach((el) => {
			const style = getComputedStyle(el);
			if (style.position === "absolute" || style.position === "fixed") {
				const parent = el.parentElement;
				if (parent && getComputedStyle(parent).position === "static") {
					shifts.push(
						`${this.generateDetailedSelector(el)} is positioned relative to a static parent`,
					);
				}
			}
		});
		return shifts;
	}

	private findUnusedSelectors(): string[] {
		// This would require parsing all CSS rules, which is complex
		// For now, return a placeholder
		return [".unused-class", "#unused-id"];
	}

	private findSpecificityConflicts(): Array<{
		selector: string;
		conflict_type: string;
	}> {
		return []; // Placeholder implementation
	}

	private identifyPerformanceIssues(): Array<{
		property: string;
		impact: string;
	}> {
		const issues: Array<{ property: string; impact: string }> = [];

		document.querySelectorAll("*").forEach((element) => {
			const style = getComputedStyle(element);

			// Check for expensive properties
			if (style.filter !== "none") {
				issues.push({
					property: "filter",
					impact: `Used on ${this.generateDetailedSelector(element)} - can impact performance`,
				});
			}

			if (
				style.boxShadow !== "none" &&
				style.boxShadow !== "rgba(0, 0, 0, 0)"
			) {
				issues.push({
					property: "box-shadow",
					impact: `Used on ${this.generateDetailedSelector(element)} - can cause repaints`,
				});
			}
		});

		return issues;
	}
}
