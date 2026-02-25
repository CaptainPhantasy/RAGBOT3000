/**
 * RAGBOT Vision Agent — Tool Definitions for Gemini Function Calling
 * 
 * These are the tools the Gemini Live session can invoke to analyze,
 * navigate, and interact with web pages through structured DOM access.
 */

import { Type } from '@google/genai';

// Tool declaration format for Gemini function calling
export const VISION_AGENT_TOOLS = {
  functionDeclarations: [
    {
      name: 'analyze_page',
      description: 'Perform a comprehensive analysis of the current web page. Returns layout structure, accessibility violations, CSS issues, content problems, and an overall quality score. Use this when you need a full picture of the page.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          include_css: {
            type: Type.BOOLEAN,
            description: 'Include detailed CSS analysis (layout systems, custom properties, animations). Default true.',
          },
          include_accessibility: {
            type: Type.BOOLEAN,
            description: 'Include WCAG accessibility audit. Default true.',
          },
          viewport_scroll: {
            type: Type.BOOLEAN,
            description: 'Scroll through the entire page to capture below-fold content. Default false.',
          },
        },
      },
    },
    {
      name: 'analyze_element',
      description: 'Get detailed information about a specific element: computed styles, position, accessibility attributes, text content, and children. Use this to inspect a specific part of the page.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          selector: {
            type: Type.STRING,
            description: 'CSS selector for the element (e.g. "#login-btn", ".nav-menu", "header")',
          },
        },
        required: ['selector'],
      },
    },
    {
      name: 'find_elements',
      description: 'Search for elements by visible text, aria-label, placeholder, alt text, or role. Use this when you know what something says or does but not its selector.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          query: {
            type: Type.STRING,
            description: 'Text to search for (e.g. "Login", "Submit", "Search box")',
          },
          search_by: {
            type: Type.STRING,
            description: 'What to search: "text", "aria", "placeholder", "alt", "role", or "any" (default "any")',
          },
          limit: {
            type: Type.NUMBER,
            description: 'Maximum results to return. Default 10.',
          },
        },
        required: ['query'],
      },
    },
    {
      name: 'check_accessibility',
      description: 'Run a focused WCAG accessibility audit. Returns violations grouped by severity with specific elements and fix suggestions.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          scope: {
            type: Type.STRING,
            description: 'CSS selector to limit audit scope, or empty for full page.',
          },
          level: {
            type: Type.STRING,
            description: 'WCAG level to check: "A", "AA" (default), or "AAA".',
          },
        },
      },
    },
    {
      name: 'extract_css',
      description: 'Extract computed CSS properties for an element. Returns all visual styling including colors, fonts, spacing, layout, transforms, and animations.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          selector: {
            type: Type.STRING,
            description: 'CSS selector for the element.',
          },
          properties: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Specific CSS properties to extract. Empty for all relevant properties.',
          },
        },
        required: ['selector'],
      },
    },
    {
      name: 'check_contrast',
      description: 'Check color contrast ratio between text and background for specific elements or the entire page. Returns WCAG AA/AAA pass/fail status.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          selector: {
            type: Type.STRING,
            description: 'CSS selector to check, or empty for all text elements.',
          },
        },
      },
    },
    {
      name: 'click_element',
      description: 'Click on a specific element. Returns what changed on the page after the click.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          selector: {
            type: Type.STRING,
            description: 'CSS selector for the element to click.',
          },
        },
        required: ['selector'],
      },
    },
    {
      name: 'scroll_to',
      description: 'Scroll to a specific element or position on the page.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          target: {
            type: Type.STRING,
            description: 'CSS selector, or "top", "bottom", "up", "down".',
          },
        },
        required: ['target'],
      },
    },
    {
      name: 'navigate_to',
      description: 'Navigate the browser to a new URL.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          url: {
            type: Type.STRING,
            description: 'The URL to navigate to.',
          },
        },
        required: ['url'],
      },
    },
    {
      name: 'extract_text',
      description: 'Extract text content from one or more elements.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          selector: {
            type: Type.STRING,
            description: 'CSS selector (can match multiple elements).',
          },
        },
        required: ['selector'],
      },
    },
    {
      name: 'get_page_state',
      description: 'Get current page metadata: URL, title, viewport size, scroll position, document dimensions, active element.',
      parameters: {
        type: Type.OBJECT,
        properties: {},
      },
    },
    {
      name: 'write_observation',
      description: 'Write the latest analysis results to the observation markdown file for external LLM consumption.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          summary: {
            type: Type.STRING,
            description: 'A human-readable summary to prepend to the observation.',
          },
        },
      },
    },
    {
      name: 'read_commands',
      description: 'Check the command markdown file for new instructions from an external LLM.',
      parameters: {
        type: Type.OBJECT,
        properties: {},
      },
    },
  ],
};

export type ToolName = typeof VISION_AGENT_TOOLS.functionDeclarations[number]['name'];