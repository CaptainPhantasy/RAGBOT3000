# RAGBOT Vision Agent — LLM Integration Protocol

**You are reading this because you need to interact with a web page you cannot see.**

The RAGBOT Vision Agent is running in a browser window. It can see, analyze, and interact with web pages on your behalf. You communicate with it through two markdown files.

---

## How It Works

```
┌──────────┐     RAGBOT_COMMANDS.md      ┌──────────────────┐
│          │ ──── (you write here) ────▶ │                  │
│  YOUR    │                              │  RAGBOT Vision   │
│  LLM     │                              │  Agent (browser) │
│          │ ◀── (it writes here) ─────  │                  │
└──────────┘    RAGBOT_OBSERVATIONS.md    └──────────────────┘
```

1. **You write commands** to `RAGBOT_COMMANDS.md`
2. **The agent executes them** and writes results to `RAGBOT_OBSERVATIONS.md`
3. **You read the observations** to understand what's on screen
4. **Repeat** until your task is complete

---

## File Locations

Both files live in the same directory as this protocol document:

- **Your input:** `RAGBOT_COMMANDS.md` — You write commands here
- **Agent output:** `RAGBOT_OBSERVATIONS.md` — You read results here
- **This file:** `RAGBOT_PROTOCOL.md` — Reference only, do not modify

---

## Step 1: Read the Observations

Before doing anything, read `RAGBOT_OBSERVATIONS.md`. It contains:

- **Current URL and page title**
- **Overall quality score** (0-100)
- **All interactive elements** with CSS selectors and screen coordinates
- **Accessibility violations** with severity and fix suggestions
- **Color contrast issues** with exact ratios
- **Images** with alt text status
- **Forms** with field labels and validation
- **CSS layout** (flexbox, grid, animations, media queries)
- **Technical issues** (missing DOCTYPE, lang, viewport, etc.)

This is your eyes. Every element listed includes a **CSS selector** you can use in commands.

---

## Step 2: Write Commands

Append commands to `RAGBOT_COMMANDS.md` using this exact format:

```markdown
### Command #[unique-id] (Pending)
**Action:** [action_name]
**Target:** [css_selector_or_value]
**Parameters:**
```json
{}
```
```

### Available Actions

| Action | Target | What It Does | Returns |
|--------|--------|-------------|---------|
| `analyze_page` | *(none)* | Full page audit | Layout, accessibility, CSS, content, score |
| `analyze_element` | CSS selector | Deep inspection of one element | All styles, position, accessibility, attributes |
| `find_elements` | Search text | Find elements by visible text, aria-label, placeholder, alt, role | Matching elements with selectors and coordinates |
| `check_accessibility` | CSS selector or empty | WCAG audit | Violations with severity and fixes |
| `check_contrast` | CSS selector or empty | Color contrast check | Elements failing WCAG contrast ratios |
| `extract_css` | CSS selector | Get computed CSS | All visual properties |
| `extract_text` | CSS selector | Get text content | Text from matching elements |
| `click_element` | CSS selector | Click an element | What changed on the page after click |
| `scroll_to` | CSS selector or `top`/`bottom`/`up`/`down` | Scroll the viewport | New scroll position |
| `navigate_to` | URL | Go to a new page | New page analysis |
| `get_page_state` | *(none)* | Current URL, viewport, scroll, active element | Page metadata |

### Command Examples

**Analyze the full page:**
```markdown
### Command #001 (Pending)
**Action:** analyze_page
**Target:** 
**Parameters:**
```json
{"include_css": true, "include_accessibility": true}
```
```

**Find a button by its label:**
```markdown
### Command #002 (Pending)
**Action:** find_elements
**Target:** Submit
**Parameters:**
```json
{"search_by": "any"}
```
```

**Click a specific button:**
```markdown
### Command #003 (Pending)
**Action:** click_element
**Target:** #submit-btn
**Parameters:**
```json
{}
```
```

**Check if a form has proper labels:**
```markdown
### Command #004 (Pending)
**Action:** analyze_element
**Target:** form#login
**Parameters:**
```json
{}
```
```

**Get the CSS of a specific element:**
```markdown
### Command #005 (Pending)
**Action:** extract_css
**Target:** .hero-banner
**Parameters:**
```json
{"properties": ["color", "background-color", "font-size", "padding", "margin"]}
```
```

---

## Step 3: Read Results

After writing a command, wait briefly, then re-read `RAGBOT_OBSERVATIONS.md`. Your command's result will appear at the top. The agent marks processed commands as `(Processed)` in the commands file.

---

## Common Workflows

### "I deployed my web app and want to check it"

1. Write: `navigate_to` with your app's URL
2. Read observations — you now have the full page structure
3. Write: `check_accessibility` to find WCAG issues
4. Write: `check_contrast` to find color problems
5. Read observations for the complete audit

### "I need to test a user flow"

1. Write: `analyze_page` to see what's on screen
2. Write: `find_elements` with "Login" to find the login button
3. Write: `click_element` with the selector from step 2
4. Read observations — see what the page looks like after the click
5. Write: `find_elements` with "Password" to find the password field
6. Continue navigating...

### "I want to verify my CSS looks right"

1. Write: `analyze_page` (includes CSS summary)
2. Write: `extract_css` on specific elements you care about
3. Read observations for exact computed values

### "I need to read what's on screen"

1. Write: `extract_text` with `body` to get all visible text
2. Or write: `extract_text` with a specific selector for targeted extraction

---

## Understanding Selectors

The observations file lists CSS selectors for every element. Use these in your commands:

- `#my-id` — Element with id="my-id"
- `.my-class` — Element with class="my-class"  
- `button` — All button elements
- `form input` — All inputs inside forms
- `nav > a:nth-child(2)` — Second link in nav

If you don't know the selector, use `find_elements` with the visible text.

---

## Understanding the Score

The page score (0-100) deducts points for:

- Missing alt text on images: -5 per image
- Missing form labels: -5 per input
- Color contrast failures: -5 per element
- Technical issues (missing DOCTYPE, lang, viewport): -3 each
- Accessibility violations: -4 each

A score of 100 means no detectable issues. Below 60 indicates serious problems.

---

## Error Handling

If a command fails, the observation will contain:
```json
{"error": "Element not found: #nonexistent"}
```

Common errors:
- **Element not found** — The selector doesn't match anything. Use `find_elements` to search by text instead.
- **No elements found** — Same as above but for multi-element queries.
- **URL is required** — You used `navigate_to` without a URL.

---

## Important Notes

- **Commands are processed in order.** Don't write 10 commands at once — write one, read the result, then write the next.
- **The page changes after interactions.** After `click_element` or `navigate_to`, the previous element selectors may be stale. Re-run `analyze_page` to get fresh selectors.
- **Coordinates are viewport-relative.** The `center` values in interactive elements are pixels from the top-left of the browser window.
- **The agent sees the same page as a real user.** It runs in a real browser with full CSS rendering, JavaScript execution, and responsive layout.
- **Observations are cumulative.** The latest observation is always at the top of the file. Older observations remain below for context.

---

*RAGBOT Vision Agent — Giving LLMs the ability to see.*