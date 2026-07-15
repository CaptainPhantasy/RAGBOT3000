/**
 * RAGBOT Vision Agent — Execution Engine
 * 
 * Handles all tool calls from Gemini. Each method returns a JSON-serializable
 * result that gets sent back to the model as a function response.
 * 
 * This is the bridge between Gemini's intent and the actual DOM.
 */

import { extensionBridge } from './extensionBridge';

// Snapshot for change detection
let lastSnapshot: string | null = null;

function takeSnapshot(): string {
  return document.body.innerHTML;
}

function diffSnapshot(): string[] {
  const current = takeSnapshot();
  if (!lastSnapshot) {
    lastSnapshot = current;
    return ['Initial snapshot taken'];
  }
  const changes: string[] = [];
  if (current !== lastSnapshot) {
    // Compare lengths as rough indicator
    const lenDiff = current.length - lastSnapshot.length;
    changes.push(`DOM changed: ${lenDiff > 0 ? '+' : ''}${lenDiff} chars`);
    
    // Check for new/removed elements
    const oldCount = (lastSnapshot.match(/<[a-z]/gi) || []).length;
    const newCount = (current.match(/<[a-z]/gi) || []).length;
    if (newCount !== oldCount) {
      changes.push(`Element count: ${oldCount} → ${newCount} (${newCount - oldCount > 0 ? '+' : ''}${newCount - oldCount})`);
    }
    
    // Check URL change
    changes.push(`URL: ${window.location.href}`);
  } else {
    changes.push('No DOM changes detected');
  }
  lastSnapshot = current;
  return changes;
}

// ─── Helpers ───

function selectorOf(el: Element): string {
  if (el.id) return `#${el.id}`;
  const tag = el.tagName.toLowerCase();
  const cls = Array.from(el.classList).filter(c => c.length < 30).slice(0, 2);
  if (cls.length) return `${tag}.${cls.join('.')}`;
  if (el.parentElement) {
    const siblings = Array.from(el.parentElement.children);
    const idx = siblings.indexOf(el) + 1;
    return `${selectorOf(el.parentElement)} > ${tag}:nth-child(${idx})`;
  }
  return tag;
}

function getRect(el: Element) {
  const r = el.getBoundingClientRect();
  return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
}

function isVisible(el: Element): boolean {
  const s = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  return s.display !== 'none' && s.visibility !== 'hidden' && parseFloat(s.opacity) > 0 && r.width > 0 && r.height > 0;
}

function getContrastRatio(fg: number[], bg: number[]): number {
  const lum = (rgb: number[]) => {
    const [r, g, b] = rgb.map(v => {
      v = v / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const l1 = lum(fg), l2 = lum(bg);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function parseColor(str: string): number[] | null {
  const m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  return m ? [+m[1], +m[2], +m[3]] : null;
}

// ─── Tool Implementations ───

export async function analyzePage(args: { include_css?: boolean; include_accessibility?: boolean; viewport_scroll?: boolean }) {
  takeSnapshot(); // baseline for change detection

  const result: any = {};
  
  // Page metadata
  result.url = window.location.href;
  result.title = document.title;
  result.viewport = { width: window.innerWidth, height: window.innerHeight };
  result.document_height = document.documentElement.scrollHeight;

  // Layout structure
  const landmarks: any[] = [];
  ['header', 'nav', 'main', 'aside', 'footer', 'form'].forEach(tag => {
    document.querySelectorAll(`${tag}, [role="${tag}"]`).forEach(el => {
      landmarks.push({ type: tag, selector: selectorOf(el), text: el.textContent?.slice(0, 60)?.trim() });
    });
  });
  result.landmarks = landmarks;

  // Heading hierarchy
  const headings: any[] = [];
  document.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(h => {
    headings.push({ level: +h.tagName[1], text: h.textContent?.trim()?.slice(0, 100), selector: selectorOf(h) });
  });
  result.headings = headings;

  // Images audit
  const images: any[] = [];
  document.querySelectorAll('img').forEach(img => {
    const i = img as HTMLImageElement;
    images.push({
      src: i.src.slice(0, 120),
      alt: i.alt || null,
      dimensions: i.naturalWidth ? `${i.naturalWidth}x${i.naturalHeight}` : null,
      issue: !i.alt ? 'MISSING_ALT' : undefined,
    });
  });
  result.images = images;

  // Links audit
  const links: any[] = [];
  document.querySelectorAll('a').forEach(a => {
    const anchor = a as HTMLAnchorElement;
    links.push({
      text: anchor.textContent?.trim()?.slice(0, 60),
      href: anchor.href?.slice(0, 120),
      selector: selectorOf(anchor),
      visible: isVisible(anchor),
    });
  });
  result.links = links.slice(0, 30);

  // Forms audit
  const forms: any[] = [];
  document.querySelectorAll('form').forEach(form => {
    const inputs: any[] = [];
    form.querySelectorAll('input,select,textarea').forEach(inp => {
      const i = inp as HTMLInputElement;
      const label = form.querySelector(`label[for="${i.id}"]`);
      inputs.push({
        type: i.type || i.tagName.toLowerCase(),
        name: i.name || null,
        id: i.id || null,
        placeholder: i.placeholder || null,
        label: label?.textContent?.trim() || i.getAttribute('aria-label') || null,
        issue: !label && !i.getAttribute('aria-label') && !i.getAttribute('aria-labelledby') ? 'MISSING_LABEL' : undefined,
      });
    });
    forms.push({ selector: selectorOf(form), action: (form as HTMLFormElement).action, inputs });
  });
  result.forms = forms;

  // Interactive elements for navigation guidance
  const interactive: any[] = [];
  document.querySelectorAll('a,button,input[type="submit"],input[type="button"],[role="button"],[tabindex]').forEach(el => {
    if (!isVisible(el)) return;
    const rect = getRect(el);
    interactive.push({
      tag: el.tagName.toLowerCase(),
      text: el.textContent?.trim()?.slice(0, 60),
      selector: selectorOf(el),
      aria_label: el.getAttribute('aria-label'),
      center: { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 },
    });
  });
  result.interactive_elements = interactive.slice(0, 40);

  // CSS analysis
  if (args.include_css !== false) {
    result.css = analyzeCSSSnapshot();
  }

  // Accessibility
  if (args.include_accessibility !== false) {
    result.accessibility = analyzeAccessibilitySnapshot();
  }

  // Contrast issues
  result.contrast_issues = checkContrastSnapshot();

  // Technical issues
  const techIssues: string[] = [];
  if (!document.doctype) techIssues.push('Missing DOCTYPE');
  if (!document.documentElement.lang) techIssues.push('Missing lang attribute on <html>');
  if (!document.querySelector('meta[name="viewport"]')) techIssues.push('Missing viewport meta tag');
  if (!document.querySelector('meta[name="description"]')) techIssues.push('Missing meta description');
  const h1s = document.querySelectorAll('h1');
  if (h1s.length === 0) techIssues.push('No <h1> element found');
  if (h1s.length > 1) techIssues.push(`Multiple <h1> elements (${h1s.length})`);
  result.technical_issues = techIssues;

  // Score
  let score = 100;
  score -= result.images.filter((i: any) => i.issue).length * 5;
  score -= result.forms.reduce((acc: number, f: any) => acc + f.inputs.filter((i: any) => i.issue).length * 5, 0);
  score -= (result.contrast_issues?.length || 0) * 5;
  score -= techIssues.length * 3;
  score -= (result.accessibility?.violations?.length || 0) * 4;
  result.score = Math.max(0, Math.min(100, score));

  return result;
}

export async function analyzeElement(args: { selector: string }) {
  const el = document.querySelector(args.selector);
  if (!el) return { error: `Element not found: ${args.selector}` };

  const style = getComputedStyle(el);
  const rect = getRect(el);

  return {
    selector: args.selector,
    resolved_selector: selectorOf(el),
    tag: el.tagName.toLowerCase(),
    id: el.id || null,
    classes: Array.from(el.classList),
    text: el.textContent?.trim()?.slice(0, 200),
    inner_html_length: el.innerHTML.length,
    visible: isVisible(el),
    position: rect,
    children_count: el.children.length,
    attributes: Array.from(el.attributes).map(a => ({ name: a.name, value: a.value.slice(0, 100) })),
    computed_styles: {
      display: style.display,
      position: style.position,
      width: style.width,
      height: style.height,
      margin: style.margin,
      padding: style.padding,
      color: style.color,
      backgroundColor: style.backgroundColor,
      fontSize: style.fontSize,
      fontFamily: style.fontFamily,
      fontWeight: style.fontWeight,
      lineHeight: style.lineHeight,
      textAlign: style.textAlign,
      border: style.border,
      borderRadius: style.borderRadius,
      overflow: style.overflow,
      zIndex: style.zIndex,
      opacity: style.opacity,
      transform: style.transform,
      transition: style.transition,
      animation: style.animationName !== 'none' ? style.animation : 'none',
      flexDirection: style.display.includes('flex') ? style.flexDirection : undefined,
      gridTemplateColumns: style.display.includes('grid') ? style.gridTemplateColumns : undefined,
    },
    accessibility: {
      role: el.getAttribute('role'),
      aria_label: el.getAttribute('aria-label'),
      aria_labelledby: el.getAttribute('aria-labelledby'),
      aria_describedby: el.getAttribute('aria-describedby'),
      aria_hidden: el.getAttribute('aria-hidden'),
      tabindex: el.getAttribute('tabindex'),
    },
  };
}

export async function findElements(args: { query: string; search_by?: string; limit?: number }) {
  const query = args.query.toLowerCase();
  const searchBy = args.search_by || 'any';
  const limit = args.limit || 10;
  const results: any[] = [];

  const allElements = document.querySelectorAll('*');
  allElements.forEach(el => {
    if (results.length >= limit) return;
    let match = false;
    let matchType = '';

    const text = el.textContent?.trim()?.toLowerCase() || '';
    const ariaLabel = el.getAttribute('aria-label')?.toLowerCase() || '';
    const placeholder = (el as HTMLInputElement).placeholder?.toLowerCase() || '';
    const alt = (el as HTMLImageElement).alt?.toLowerCase() || '';
    const role = el.getAttribute('role')?.toLowerCase() || '';
    const title = el.getAttribute('title')?.toLowerCase() || '';

    if (searchBy === 'any' || searchBy === 'text') {
      // Direct text match (not deep children text)
      const directText = Array.from(el.childNodes)
        .filter(n => n.nodeType === Node.TEXT_NODE)
        .map(n => n.textContent?.trim()?.toLowerCase())
        .join(' ');
      if (directText.includes(query)) { match = true; matchType = 'text'; }
    }
    if (!match && (searchBy === 'any' || searchBy === 'aria')) {
      if (ariaLabel.includes(query)) { match = true; matchType = 'aria-label'; }
    }
    if (!match && (searchBy === 'any' || searchBy === 'placeholder')) {
      if (placeholder.includes(query)) { match = true; matchType = 'placeholder'; }
    }
    if (!match && (searchBy === 'any' || searchBy === 'alt')) {
      if (alt.includes(query)) { match = true; matchType = 'alt'; }
    }
    if (!match && (searchBy === 'any' || searchBy === 'role')) {
      if (role.includes(query)) { match = true; matchType = 'role'; }
    }
    if (!match && searchBy === 'any') {
      if (title.includes(query)) { match = true; matchType = 'title'; }
    }

    if (match && isVisible(el)) {
      const rect = getRect(el);
      results.push({
        match_type: matchType,
        tag: el.tagName.toLowerCase(),
        selector: selectorOf(el),
        text: el.textContent?.trim()?.slice(0, 80),
        aria_label: el.getAttribute('aria-label'),
        center: { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 },
        size: { w: rect.w, h: rect.h },
      });
    }
  });

  return { query: args.query, results_count: results.length, results };
}

export async function checkAccessibility(args: { scope?: string; level?: string }) {
  const scope = args.scope ? document.querySelector(args.scope) : document.body;
  if (!scope) return { error: `Scope element not found: ${args.scope}` };

  const violations: any[] = [];

  // Images without alt
  scope.querySelectorAll('img').forEach(img => {
    if (!(img as HTMLImageElement).alt) {
      violations.push({ rule: '1.1.1 Non-text Content', severity: 'serious', element: selectorOf(img), fix: 'Add descriptive alt attribute' });
    }
  });

  // Form inputs without labels
  scope.querySelectorAll('input,select,textarea').forEach(inp => {
    const i = inp as HTMLInputElement;
    if (i.type === 'hidden' || i.type === 'submit' || i.type === 'button') return;
    const hasLabel = i.id && scope!.querySelector(`label[for="${i.id}"]`);
    const hasAria = i.getAttribute('aria-label') || i.getAttribute('aria-labelledby');
    if (!hasLabel && !hasAria) {
      violations.push({ rule: '1.3.1 Info and Relationships', severity: 'serious', element: selectorOf(inp), fix: 'Add label or aria-label' });
    }
  });

  // Missing lang
  if (!document.documentElement.lang) {
    violations.push({ rule: '3.1.1 Language of Page', severity: 'serious', element: 'html', fix: 'Add lang attribute to <html>' });
  }

  // Skip navigation
  const firstLink = document.querySelector('a');
  if (firstLink && !firstLink.getAttribute('href')?.startsWith('#')) {
    violations.push({ rule: '2.4.1 Bypass Blocks', severity: 'moderate', element: 'body', fix: 'Add skip navigation link' });
  }

  // Empty links/buttons
  scope.querySelectorAll('a, button, [role="button"]').forEach(el => {
    const text = el.textContent?.trim();
    const aria = el.getAttribute('aria-label');
    if (!text && !aria) {
      violations.push({ rule: '2.4.4 Link Purpose', severity: 'serious', element: selectorOf(el), fix: 'Add text content or aria-label' });
    }
  });

  // Heading order
  let lastLevel = 0;
  document.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(h => {
    const level = +h.tagName[1];
    if (level > lastLevel + 1 && lastLevel > 0) {
      violations.push({ rule: '1.3.1 Heading Order', severity: 'moderate', element: selectorOf(h), fix: `Heading skips from h${lastLevel} to h${level}` });
    }
    lastLevel = level;
  });

  // Contrast (delegate)
  const contrastIssues = checkContrastSnapshot();
  contrastIssues.forEach(issue => {
    violations.push({ rule: '1.4.3 Contrast', severity: 'serious', ...issue });
  });

  return {
    violations_count: violations.length,
    violations,
    level_checked: args.level || 'AA',
  };
}

export async function extractCSS(args: { selector: string; properties?: string[] }) {
  const el = document.querySelector(args.selector);
  if (!el) return { error: `Element not found: ${args.selector}` };

  const style = getComputedStyle(el);
  const props = args.properties && args.properties.length > 0
    ? args.properties
    : [
        'display', 'position', 'top', 'right', 'bottom', 'left',
        'width', 'height', 'min-width', 'max-width', 'min-height', 'max-height',
        'margin', 'padding', 'border', 'border-radius',
        'color', 'background-color', 'background-image', 'background',
        'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing', 'text-align', 'text-decoration', 'text-transform',
        'overflow', 'overflow-x', 'overflow-y',
        'flex-direction', 'flex-wrap', 'justify-content', 'align-items', 'gap',
        'grid-template-columns', 'grid-template-rows', 'grid-gap',
        'transform', 'transition', 'animation', 'opacity',
        'z-index', 'box-shadow', 'cursor', 'pointer-events',
      ];

  const extracted: Record<string, string> = {};
  props.forEach(p => {
    const val = style.getPropertyValue(p);
    if (val && val !== 'none' && val !== 'normal' && val !== 'auto' && val !== '0px' && val !== 'rgba(0, 0, 0, 0)') {
      extracted[p] = val;
    }
  });

  return { selector: args.selector, styles: extracted };
}

export async function checkContrast(args: { selector?: string }) {
  return { issues: checkContrastSnapshot(args.selector) };
}

export async function clickElement(args: { selector: string }) {
  takeSnapshot(); // before
  const el = document.querySelector(args.selector);
  if (!el) return { error: `Element not found: ${args.selector}` };

  (el as HTMLElement).click();
  await new Promise(r => setTimeout(r, 500));

  const changes = diffSnapshot();
  return { clicked: args.selector, url_after: window.location.href, title_after: document.title, changes };
}

export async function scrollTo(args: { target: string }) {
  if (args.target === 'top') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return { scrolled_to: 'top', scroll_y: 0 };
  }
  if (args.target === 'bottom') {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    return { scrolled_to: 'bottom', scroll_y: document.body.scrollHeight };
  }
  if (args.target === 'up') {
    window.scrollBy({ top: -window.innerHeight * 0.8, behavior: 'smooth' });
    return { scrolled_to: 'up', scroll_y: window.scrollY };
  }
  if (args.target === 'down') {
    window.scrollBy({ top: window.innerHeight * 0.8, behavior: 'smooth' });
    return { scrolled_to: 'down', scroll_y: window.scrollY };
  }

  const el = document.querySelector(args.target);
  if (!el) return { error: `Element not found: ${args.target}` };
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await new Promise(r => setTimeout(r, 300));
  return { scrolled_to: args.target, element_position: getRect(el) };
}

export async function navigateTo(args: { url: string }) {
  if (!args.url) return { error: 'URL is required' };
  if (extensionBridge.isConnected()) {
    return extensionBridge.execute('open_tab', { url: args.url });
  }
  window.location.href = args.url;
  return { navigating_to: args.url };
}

async function openTab(args: Record<string, any>): Promise<any> {
  if (!extensionBridge.isConnected()) {
    return { error: 'Browser extension not installed. Install the Tom The Peep extension for multi-tab control.' };
  }
  return extensionBridge.execute('open_tab', args);
}

async function closeTab(args: Record<string, any>): Promise<any> {
  if (!extensionBridge.isConnected()) {
    return { error: 'Browser extension not installed. Install the Tom The Peep extension for multi-tab control.' };
  }
  return extensionBridge.execute('close_tab', args);
}

async function switchTab(args: Record<string, any>): Promise<any> {
  if (!extensionBridge.isConnected()) {
    return { error: 'Browser extension not installed. Install the Tom The Peep extension for multi-tab control.' };
  }
  return extensionBridge.execute('switch_tab', args);
}

async function listTabs(): Promise<any> {
  if (!extensionBridge.isConnected()) {
    return { error: 'Browser extension not installed. Install the Tom The Peep extension for multi-tab control.' };
  }
  return extensionBridge.execute('list_tabs', {});
}

async function typeText(args: Record<string, any>): Promise<any> {
  if (!extensionBridge.isConnected()) {
    return { error: 'Browser extension not installed. Install the Tom The Peep extension for multi-tab control.' };
  }
  return extensionBridge.execute('type_text', args);
}

async function fillForm(args: Record<string, any>): Promise<any> {
  if (!extensionBridge.isConnected()) {
    return { error: 'Browser extension not installed. Install the Tom The Peep extension for multi-tab control.' };
  }
  return extensionBridge.execute('fill_form', args);
}

async function selectOption(args: Record<string, any>): Promise<any> {
  if (!extensionBridge.isConnected()) {
    return { error: 'Browser extension not installed. Install the Tom The Peep extension for multi-tab control.' };
  }
  return extensionBridge.execute('select_option', args);
}

async function takeScreenshot(args: Record<string, any>): Promise<any> {
  if (!extensionBridge.isConnected()) {
    return { error: 'Browser extension not installed. Install the Tom The Peep extension for multi-tab control.' };
  }
  return extensionBridge.execute('take_screenshot', args);
}

async function waitForElement(args: Record<string, any>): Promise<any> {
  if (!extensionBridge.isConnected()) {
    return { error: 'Browser extension not installed. Install the Tom The Peep extension for multi-tab control.' };
  }
  return extensionBridge.execute('wait_for_element', args);
}

async function getTabState(args: Record<string, any>): Promise<any> {
  if (!extensionBridge.isConnected()) {
    return { error: 'Browser extension not installed. Install the Tom The Peep extension for multi-tab control.' };
  }
  return extensionBridge.execute('get_tab_state', args);
}

export async function extractText(args: { selector: string }) {
  const elements = document.querySelectorAll(args.selector);
  if (elements.length === 0) return { error: `No elements found: ${args.selector}` };

  const results = Array.from(elements).map(el => ({
    selector: selectorOf(el),
    text: el.textContent?.trim()?.slice(0, 500),
    visible: isVisible(el),
  }));

  return { count: results.length, results };
}

export async function getPageState() {
  const activeEl = document.activeElement;
  return {
    url: window.location.href,
    title: document.title,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    scroll: { x: window.scrollX, y: window.scrollY },
    document_size: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
    active_element: activeEl && activeEl !== document.body ? selectorOf(activeEl) : null,
    ready_state: document.readyState,
  };
}

// ─── Internal helpers ───

function analyzeCSSSnapshot() {
  const flexContainers: string[] = [];
  const gridContainers: string[] = [];
  const customProps: any[] = [];
  const animations: any[] = [];

  // CSS custom properties from root
  const rootStyle = getComputedStyle(document.documentElement);
  for (const prop of rootStyle) {
    if (prop.startsWith('--')) {
      customProps.push({ name: prop, value: rootStyle.getPropertyValue(prop).trim().slice(0, 80) });
    }
  }

  // Layout systems and animations
  document.querySelectorAll('*').forEach(el => {
    const s = getComputedStyle(el);
    if (s.display === 'flex' || s.display === 'inline-flex') flexContainers.push(selectorOf(el));
    if (s.display === 'grid' || s.display === 'inline-grid') gridContainers.push(selectorOf(el));
    if (s.animationName !== 'none') animations.push({ element: selectorOf(el), name: s.animationName, duration: s.animationDuration });
  });

  // Media queries
  const mediaQueries: string[] = [];
  Array.from(document.styleSheets).forEach(sheet => {
    try {
      Array.from(sheet.cssRules || []).forEach(rule => {
        if (rule instanceof CSSMediaRule) {
          mediaQueries.push(rule.media.mediaText);
        }
      });
    } catch { /* cross-origin sheets */ }
  });

  return {
    flex_containers: flexContainers.length,
    grid_containers: gridContainers.length,
    custom_properties: customProps.slice(0, 20),
    animations: animations.slice(0, 10),
    media_queries: [...new Set(mediaQueries)],
  };
}

function analyzeAccessibilitySnapshot() {
  const violations: any[] = [];

  document.querySelectorAll('img').forEach(img => {
    if (!(img as HTMLImageElement).alt) violations.push({ type: 'missing_alt', element: selectorOf(img) });
  });

  document.querySelectorAll('input,select,textarea').forEach(inp => {
    const i = inp as HTMLInputElement;
    if (i.type === 'hidden' || i.type === 'submit' || i.type === 'button') return;
    const hasLabel = i.id && document.querySelector(`label[for="${i.id}"]`);
    if (!hasLabel && !i.getAttribute('aria-label') && !i.getAttribute('aria-labelledby')) {
      violations.push({ type: 'missing_label', element: selectorOf(inp) });
    }
  });

  return { violations_count: violations.length, violations };
}

function checkContrastSnapshot(selector?: string) {
  const issues: any[] = [];
  const elements = document.querySelectorAll(selector || 'p, span, a, button, h1, h2, h3, h4, h5, h6, li, td, th, label');

  elements.forEach(el => {
    if (!isVisible(el)) return;
    const s = getComputedStyle(el);
    const fg = parseColor(s.color);
    const bg = parseColor(s.backgroundColor);
    if (!fg) return;
    
    // Walk up the DOM tree to find effective background color
    let bgColor: number[] | null = null;
    let current: Element | null = el;
    while (current) {
      const currentStyle = getComputedStyle(current);
      const currentBg = currentStyle.backgroundColor;
      if (currentBg && currentBg !== 'rgba(0, 0, 0, 0)' && currentBg !== 'transparent') {
        bgColor = parseColor(currentBg);
        break;
      }
      current = current.parentElement;
    }
    // Default to white if no background found
    if (!bgColor) bgColor = [255, 255, 255];

    const ratio = getContrastRatio(fg, bgColor);
    const fontSize = parseFloat(s.fontSize);
    const isBold = parseInt(s.fontWeight) >= 700;
    const isLargeText = fontSize >= 24 || (fontSize >= 18.66 && isBold);
    const passesAA = isLargeText ? ratio >= 3 : ratio >= 4.5;

    if (!passesAA) {
      issues.push({
        element: selectorOf(el),
        text: el.textContent?.trim()?.slice(0, 40),
        foreground: s.color,
        background: `rgb(${bgColor.join(', ')})`,
        ratio: Math.round(ratio * 100) / 100,
        required: isLargeText ? 3 : 4.5,
        fix: `Increase contrast ratio from ${ratio.toFixed(1)}:1 to at least ${isLargeText ? 3 : 4.5}:1`,
      });
    }
  });

  return issues.slice(0, 15);
}

// ─── Markdown I/O (browser-compatible via localStorage) ───

const OBS_KEY = 'ragbot_observations_md';
const CMD_KEY = 'ragbot_commands_md';

export async function writeObservation(args: { summary?: string }) {
  const analysis = await analyzePage({ include_css: true, include_accessibility: true });
  const timestamp = new Date().toISOString();

  let md = `# RAGBOT Observation — ${timestamp}\n\n`;
  if (args.summary) md += `## Summary\n${args.summary}\n\n`;
  md += `**URL:** ${analysis.url}\n**Title:** ${analysis.title}\n**Score:** ${analysis.score}/100\n\n`;
  md += `## Critical Issues\n${analysis.technical_issues.map((i: string) => `- ${i}`).join('\n')}\n\n`;
  md += `## Accessibility (${analysis.accessibility?.violations_count || 0} issues)\n`;
  (analysis.accessibility?.violations || []).forEach((v: any) => { md += `- ${v.type}: \`${v.element}\`\n`; });
  md += `\n## Contrast Issues (${analysis.contrast_issues?.length || 0})\n`;
  (analysis.contrast_issues || []).forEach((c: any) => { md += `- \`${c.element}\` ratio ${c.ratio}:1 (need ${c.required}:1)\n`; });
  md += `\n## Interactive Elements (${analysis.interactive_elements?.length || 0})\n`;
  (analysis.interactive_elements || []).slice(0, 20).forEach((e: any) => {
    md += `- ${e.tag} \`${e.selector}\` "${e.text || e.aria_label || ''}" at (${e.center.x},${e.center.y})\n`;
  });
  md += `\n## Images (${analysis.images?.length || 0})\n`;
  (analysis.images || []).forEach((img: any) => {
    md += `- ${img.issue ? '⚠️' : '✅'} \`${img.src}\` alt="${img.alt || 'MISSING'}"\n`;
  });
  md += `\n## Forms (${analysis.forms?.length || 0})\n`;
  (analysis.forms || []).forEach((f: any) => {
    md += `- \`${f.selector}\` ${f.inputs.length} fields\n`;
    f.inputs.forEach((i: any) => { md += `  - ${i.type} ${i.name || ''} ${i.issue ? '⚠️ ' + i.issue : '✅'}\n`; });
  });
  md += `\n## CSS\n- Flexbox containers: ${analysis.css?.flex_containers}\n- Grid containers: ${analysis.css?.grid_containers}\n- Animations: ${analysis.css?.animations?.length}\n- Media queries: ${analysis.css?.media_queries?.length}\n`;
  md += `\n---\n*Generated by RAGBOT Vision Agent*\n`;

  localStorage.setItem(OBS_KEY, md + '\n\n---\n\n' + (localStorage.getItem(OBS_KEY) || ''));
  console.log('[RAGBOT-OBSERVATION]', md);

  try {
    await fetch('/api/observations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: md }),
    });
  } catch (error) {
    console.warn('[RAGBOT] Failed to write observation to the local bridge:', error);
  }

  return { written: true, timestamp, score: analysis.score, observation_length: md.length };
}

export async function readCommands() {
  let commands = '';
  try {
    const response = await fetch('/api/commands');
    if (!response.ok) throw new Error(`bridge returned ${response.status}`);
    const data = await response.json();
    commands = data.content || '';
  } catch (error) {
    console.warn('[RAGBOT] Failed to read commands from the local bridge; using localStorage:', error);
    commands = localStorage.getItem(CMD_KEY) || '';
  }
  const pending = commands.split('### Command #').slice(1).filter(c => c.includes('(Pending)'));
  return { pending_count: pending.length, commands: pending.map(c => c.slice(0, 200)) };
}

// ─── Router: dispatch tool calls ───

export async function executeToolCall(name: string, args: any): Promise<any> {
  switch (name) {
    case 'analyze_page': return analyzePage(args);
    case 'analyze_element': return analyzeElement(args);
    case 'find_elements': return findElements(args);
    case 'check_accessibility': return checkAccessibility(args);
    case 'extract_css': return extractCSS(args);
    case 'check_contrast': return checkContrast(args);
    case 'click_element': return clickElement(args);
    case 'scroll_to': return scrollTo(args);
    case 'navigate_to': return navigateTo(args);
    case 'extract_text': return extractText(args);
    case 'get_page_state': return getPageState();
    case 'open_tab': return openTab(args);
    case 'close_tab': return closeTab(args);
    case 'switch_tab': return switchTab(args);
    case 'list_tabs': return listTabs();
    case 'type_text': return typeText(args);
    case 'fill_form': return fillForm(args);
    case 'select_option': return selectOption(args);
    case 'take_screenshot': return takeScreenshot(args);
    case 'wait_for_element': return waitForElement(args);
    case 'get_tab_state': return getTabState(args);
    case 'write_observation': return writeObservation(args);
    case 'read_commands': return readCommands();
    default: return { error: `Unknown tool: ${name}` };
  }
}
