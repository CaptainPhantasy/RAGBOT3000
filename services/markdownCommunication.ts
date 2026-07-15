import * as fs from "fs";
import * as path from "path";
import type { WebObservation } from "../memory/types";

export class MarkdownCommunication {
	private observationFile: string;
	private commandFile: string;
	private lastCommandRead = 0;
	private isWatching = false;

	constructor(baseDir: string = "/Volumes/Storage/Knowledge Bases") {
		this.observationFile = path.join(baseDir, "RAGBOT_OBSERVATIONS.md");
		this.commandFile = path.join(baseDir, "RAGBOT_COMMANDS.md");

		// Initialize files if they don't exist
		this.initializeFiles();
	}

	private initializeFiles(): void {
		// Create observation file with header
		if (!fs.existsSync(this.observationFile)) {
			fs.writeFileSync(
				this.observationFile,
				`# RAGBOT Web Analyzer - Observations for LLM

*This file contains detailed web page observations for LLM consumption.*
*Last updated: ${new Date().toISOString()}*

---

## Observations

`,
			);
		}

		// Create command file with header
		if (!fs.existsSync(this.commandFile)) {
			fs.writeFileSync(
				this.commandFile,
				`# RAGBOT Web Analyzer - Commands for Bot

*This file contains commands from LLM to guide the web analyzer bot.*
*Commands will be processed in order of appearance.*

---

## Commands

`,
			);
		}
	}

	// Write observations to Markdown file for LLM to read
	public writeObservation(observation: any): void {
		const timestamp = new Date(observation.timestamp).toLocaleString();
		const markdown = this.formatObservationAsMarkdown(observation, timestamp);

		// Read existing content
		let content = fs.readFileSync(this.observationFile, "utf-8");

		// Insert new observation after the header
		const insertionPoint =
			content.indexOf("## Observations") + "## Observations".length;
		content =
			content.slice(0, insertionPoint) +
			"\n\n" +
			markdown +
			"\n---\n" +
			content.slice(insertionPoint);

		// Update file
		fs.writeFileSync(this.observationFile, content);

		console.log(`[OBSERVATION] Written to ${this.observationFile}`);
	}

	// Watch for commands from LLM
	public startWatching(callback: (command: any) => void): void {
		if (this.isWatching) return;

		this.isWatching = true;

		// Poll for new commands
		setInterval(() => {
			this.checkForCommands(callback);
		}, 1000);

		console.log(`[COMMAND] Watching ${this.commandFile} for new commands`);
	}

	private checkForCommands(callback: (command: any) => void): void {
		try {
			const stats = fs.statSync(this.commandFile);
			if (stats.mtimeMs > this.lastCommandRead) {
				this.lastCommandRead = stats.mtimeMs;

				// Read and parse commands
				const content = fs.readFileSync(this.commandFile, "utf-8");
				const commands = this.parseCommandsFromMarkdown(content);

				// Process new commands
				commands.forEach((command) => {
					if (command.status === "pending") {
						callback(command);
					}
				});
			}
		} catch (error) {
			console.error("[COMMAND] Error checking for commands:", error);
		}
	}

	private formatObservationAsMarkdown(
		observation: WebObservation,
		timestamp: string,
	): string {
		return `
### Observation #${observation.id} - ${timestamp}

**URL:** ${observation.url}
**Page Title:** ${observation.page_title}

---

## 🎯 Critical Issues (Immediate Attention)

${
	observation.summary.critical_issues.length > 0
		? observation.summary.critical_issues
				.map((issue) => `- **${issue}**`)
				.join("\n")
		: "✅ No critical issues detected"
}

---

## 📊 Overall Assessment

- **Overall Score:** ${observation.summary.overall_score}/100
- **WCAG Compliance Level:** ${observation.accessibility.wcag_compliance.level}
- **Navigation Elements:** ${observation.layout.navigation_elements.length}
- **Forms Found:** ${observation.ux_assessment.forms.length}
- **Images Without Alt Text:** ${observation.content_analysis.media_content.images.filter((img) => img.accessibility_issue).length}

---

## 🧭 Navigation Guidance for LLM

### Interactive Elements
${observation.navigation_guidance.interactive_elements
	.slice(0, 20)
	.map(
		(el) =>
			`- **${el.element}** (${el.type}) - \`${el.selector}\`${el.coordinates ? ` at (${el.coordinates.x}, ${el.coordinates.y})` : ""}${el.text_content ? ` - "${el.text_content.substring(0, 50)}..."` : ""}`,
	)
	.join("\n")}

### Page Landmarks
${observation.navigation_guidance.page_landmarks
	.map(
		(landmark) =>
			`- **${landmark.type}** - \`${landmark.selector}\`${landmark.label ? ` - "${landmark.label}"` : ""} - ${landmark.description}`,
	)
	.join("\n")}

### Suggested Actions
${
	observation.summary.recommended_fixes
		? observation.summary.recommended_fixes
				.slice(0, 10)
				.map(
					(fix) =>
						`- **${fix.issue}** (Priority: ${fix.priority}) - ${fix.solution}`,
				)
				.join("\n")
		: ""
}

---

## ♿ Accessibility Details

### WCAG Violations (${observation.accessibility.wcag_compliance.violations.length})
${observation.accessibility.wcag_compliance.violations
	.slice(0, 10)
	.map(
		(v) =>
			`- **${v.guideline}** (${v.level}): ${v.description} on \`${v.element}\``,
	)
	.join("\n")}

### Keyboard Navigation Issues
${
	observation.accessibility.keyboard_navigation.tab_order_issues.length > 0
		? observation.accessibility.keyboard_navigation.tab_order_issues
				.map((issue) => `- ${issue}`)
				.join("\n")
		: "✅ No keyboard navigation issues detected"
}

### Color Contrast Issues
${observation.accessibility.visual_accessibility.color_contrast
	.filter((c) => !c.passes)
	.slice(0, 5)
	.map((c) => `- **\`${c.element}\`** - Ratio: ${c.ratio}:1 (fails WCAG)`)
	.join("\n")}

---

## 🎨 Visual Analysis

### Layout Structure
${observation.layout.overall_structure}

### Color Scheme
- **Primary Colors:** ${observation.visual_analysis.color_scheme.primary_colors.join(", ")}
- **Text Colors:** ${observation.visual_analysis.color_scheme.text_colors.join(", ")}
- **Background Colors:** ${observation.visual_analysis.color_scheme.background_colors.join(", ")}

### Typography
- **Fonts Used:** ${observation.visual_analysis.typography.fonts_used.join(", ")}
- **Readability Issues:** ${
			observation.visual_analysis.typography.readability_issues.length > 0
				? observation.visual_analysis.typography.readability_issues.join(", ")
				: "None detected"
		}

---

## 🔧 Technical Analysis

### CSS Layout Systems
- **Flexbox Containers:** ${observation.css_analysis.layout_systems.flexbox.containers.length}
- **Grid Containers:** ${observation.css_analysis.layout_systems.grid.containers.length}
- **CSS Performance Issues:** ${observation.css_analysis.potential_issues.performance_impact.length}

### Performance
${
	observation.technical_issues.performance.load_time
		? `- **Load Time:** ${observation.technical_issues.performance.load_time}ms`
		: "- **Load Time:** Not measured"
}
- **Optimization Opportunities:** ${observation.technical_issues.performance.optimization_opportunities.join(", ")}

### Security
- **HTTPS Status:** ${observation.technical_issues.security.https_status}
- **Mixed Content:** ${
			observation.technical_issues.security.mixed_content.length > 0
				? "Detected"
				: "None detected"
		}

---

## 📝 Content Analysis

### Images (${observation.content_analysis.media_content.images.length})
${observation.content_analysis.media_content.images
	.slice(0, 5)
	.map(
		(img) =>
			`- \`${img.src}\`${img.alt_text ? ` - "${img.alt_text}"` : " - **NO ALT TEXT**"}${img.accessibility_issue ? ` (${img.accessibility_issue})` : ""}`,
	)
	.join("\n")}

### Forms
${observation.ux_assessment.forms
	.map(
		(form) =>
			`- **${form.form_name}** (${form.fields} fields) - ${form.validation}`,
	)
	.join("\n")}

---

## ✅ Positive Aspects

${observation.summary.positive_aspects.map((aspect) => `- ${aspect}`).join("\n")}

---

## 🔗 Quick Commands for LLM

You can use these commands to interact with the page:

\`\`\`
click_element selector    # Click an element (e.g., click_element #submit-btn)
navigate_to url          # Navigate to a new URL
scroll_to selector       # Scroll to an element
extract_text selector    # Get text content from element
analyze_element selector  # Get detailed info about an element
\`\`\`

*End of Observation #${observation.id}*
`;
	}

	private parseCommandsFromMarkdown(content: string): any[] {
		const commands: any[] = [];

		// Find command sections
		const commandSections = content.split("### Command #");

		for (let i = 1; i < commandSections.length; i++) {
			const section = commandSections[i];
			const lines = section.split("\n");

			if (lines.length < 2) continue;

			const headerLine = lines[0];
			const commandMatch = headerLine.match(/^(.+?) - (.+?) \((.+?)\)/);

			if (!commandMatch) continue;

			const [, id, timestamp, status] = commandMatch;

			// Skip if already processed
			if (status.includes("Processed")) continue;

			const command: any = {
				id: id.trim(),
				timestamp: timestamp.trim(),
				status: status.toLowerCase().includes("pending")
					? "pending"
					: "processed",
				raw: section,
			};

			// Parse command details
			lines.forEach((line) => {
				if (line.startsWith("**Action:**")) {
					command.action = line.replace("**Action:**", "").trim();
				} else if (line.startsWith("**Target:**")) {
					command.target = line.replace("**Target:**", "").trim();
				} else if (line.startsWith("**Parameters:**")) {
					const jsonMatch = line.match(/```json\s*([\s\S]*?)\s*```/);
					if (jsonMatch) {
						try {
							command.parameters = JSON.parse(jsonMatch[1]);
						} catch (e) {
							console.warn("[COMMAND] Failed to parse parameters:", e);
						}
					}
				}
			});

			commands.push(command);
		}

		return commands;
	}

	// Mark command as processed
	public markCommandProcessed(commandId: string, result?: any): void {
		try {
			let content = fs.readFileSync(this.commandFile, "utf-8");

			// Find and update the command
			const commandPattern = new RegExp(
				`(### Command #${commandId} - .*? \\()([^)]*)(\\))`,
				"g",
			);
			content = content.replace(
				commandPattern,
				(match, prefix, status, suffix) => {
					return prefix + "Processed" + suffix;
				},
			);

			// Add result if provided
			if (result) {
				const insertionPoint = content.indexOf(`### Command #${commandId}`);
				const sectionEnd = content.indexOf("---", insertionPoint);

				const resultMarkdown = `\n\n**Result:** \`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\`\n`;

				content =
					content.slice(0, sectionEnd) +
					resultMarkdown +
					content.slice(sectionEnd);
			}

			fs.writeFileSync(this.commandFile, content);
			console.log(`[COMMAND] Marked command ${commandId} as processed`);
		} catch (error) {
			console.error("[COMMAND] Error marking command as processed:", error);
		}
	}
}
