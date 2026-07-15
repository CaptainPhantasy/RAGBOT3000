interface WebObservation {
	id: string;
	timestamp: number;
	url?: string;
	page_title?: string;

	// Visual Layout Observations
	layout: {
		overall_structure: string;
		header_elements: string[];
		navigation_elements: string[];
		content_sections: string[];
		sidebar_elements?: string[];
		footer_elements: string[];
		responsive_design: {
			mobile_viewport: string;
			tablet_viewport: string;
			desktop_viewport: string;
		};
	};

	// Design & Visual Issues
	visual_analysis: {
		color_scheme: {
			primary_colors: string[];
			secondary_colors: string[];
			accent_colors: string[];
			background_colors: string[];
			text_colors: string[];
			contrast_issues: Array<{
				element: string;
				issue: string;
				wcag_level: string;
			}>;
		};
		typography: {
			fonts_used: string[];
			font_sizes: Array<{ element: string; size: string; unit: string }>;
			line_heights: Array<{ element: string; ratio: number }>;
			text_alignment: Array<{ element: string; alignment: string }>;
			readability_issues: string[];
		};
		spacing: {
			margin_inconsistencies: Array<{ element: string; issue: string }>;
			padding_issues: Array<{ element: string; issue: string }>;
			layout_gaps: string[];
		};
	};

	// Content Analysis
	content_analysis: {
		text_content: {
			headings_structure: Array<{
				level: number;
				text: string;
				position: string;
			}>;
			paragraphs: Array<{
				length: number;
				readability_score: number;
				position: string;
			}>;
			lists: Array<{ type: string; items: number; position: string }>;
		};
		media_content: {
			images: Array<{
				src: string;
				alt_text?: string;
				dimensions?: string;
				accessibility_issue?: string;
			}>;
			videos: Array<{
				src: string;
				captions?: boolean;
				accessibility_issue?: string;
			}>;
		};
		spelling_grammar: Array<{
			text: string;
			position: string;
			error_type: string;
			correction?: string;
		}>;
	};

	// Comprehensive CSS Analysis
	css_analysis: {
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
	};

	// Accessibility (WCAG) Analysis
	accessibility: {
		wcag_compliance: {
			level: "A" | "AA" | "AAA" | "Non-compliant";
			violations: Array<{
				guideline: string;
				level: string;
				element: string;
				description: string;
			}>;
		};
		keyboard_navigation: {
			tab_order_issues: string[];
			focus_indicators: Array<{ element: string; visible: boolean }>;
			skip_links: string[];
		};
		screen_reader: {
			aria_labels: Array<{ element: string; label?: string; issue?: string }>;
			heading_structure: string[];
			landmark_elements: string[];
			form_labels: Array<{ element: string; label?: string; issue?: string }>;
		};
		visual_accessibility: {
			color_contrast: Array<{
				element: string;
				ratio: number;
				passes: boolean;
			}>;
			text_scaling: string[];
			flashing_content: string[];
		};
	};

	// Technical Issues
	technical_issues: {
		html_validation: Array<{
			line?: number;
			element: string;
			issue: string;
			severity: "error" | "warning" | "info";
		}>;
		performance: {
			load_time?: number;
			resource_sizes: Array<{ resource: string; size: string }>;
			optimization_opportunities: string[];
		};
		security: {
			https_status: "secure" | "mixed" | "insecure";
			mixed_content: string[];
			security_headers: Array<{ header: string; present: boolean }>;
		};
		javascript_errors: Array<{
			message: string;
			source: string;
			line?: number;
		}>;
	};

	// User Experience Assessment
	ux_assessment: {
		navigation_flow: {
			main_navigation: string[];
			breadcrumbs?: string;
			search_functionality?: string;
			user_flow_issues: string[];
		};
		forms: Array<{
			form_name: string;
			fields: number;
			validation: string;
			accessibility_issues: string[];
			usability_issues: string[];
		}>;
		calls_to_action: Array<{
			element: string;
			text: string;
			visibility: string;
			accessibility_issue?: string;
		}>;
		loading_states: Array<{
			element: string;
			loading_indicator: boolean;
			user_feedback: string;
		}>;
	};

	// Navigation Guidance for LLM
	navigation_guidance: {
		interactive_elements: Array<{
			element: string;
			type: string;
			selector: string;
			text_content?: string;
			aria_label?: string;
			coordinates?: { x: number; y: number };
		}>;
		page_landmarks: Array<{
			type: string;
			label?: string;
			selector: string;
			description: string;
		}>;
		keyboard_shortcuts: Array<{
			action: string;
			keys: string;
			description: string;
		}>;
	};

	// Summary for Human Review
	summary: {
		overall_score: number;
		critical_issues: string[];
		recommended_fixes: Array<{
			issue: string;
			priority: "critical" | "high" | "medium" | "low";
			solution: string;
		}>;
		positive_aspects: string[];
	};
}

interface MemoryFile {
	session_id: string;
	created_at: number;
	last_updated: number;
	current_url?: string;
	session_history: Array<{
		timestamp: number;
		type: "navigation" | "analysis" | "command" | "observation";
		content: string | WebObservation;
	}>;
	observations: WebObservation[];
	llm_interface: {
		ready_for_reading: boolean;
		last_read_timestamp?: number;
		pending_commands: string[];
	};
}

export type { WebObservation, MemoryFile };
