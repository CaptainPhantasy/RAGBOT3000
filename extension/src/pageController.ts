import { connect, ExtensionTransport } from 'puppeteer-core/lib/esm/puppeteer/puppeteer-core-browser.js'

type Browser = any
type PuppeteerPage = any

type ScrollTarget =
  | 'top'
  | 'bottom'
  | 'up'
  | 'down'
  | string
  | {
      x?: number
      y?: number
      selector?: string
      behavior?: ScrollBehavior
    }

type FindElementsQuery =
  | string
  | {
      query: string
      by?: 'text' | 'aria' | 'role' | 'any'
      limit?: number
    }

type FillableValue = string | number | boolean | null

export default class PageController {
  private readonly pagesByTabId = new Map<number, PuppeteerPage>()
  private readonly browsersByTabId = new Map<number, Browser>()

  constructor() {
    this.registerDetachHandlers()
  }

  async attachToTab(tabId: number): Promise<void> {
    if (!Number.isInteger(tabId) || tabId <= 0) {
      throw new Error(`Invalid tabId: ${tabId}`)
    }

    if (this.isAttached(tabId)) {
      return
    }

    await this.assertControllableTab(tabId)

    const browser = await connect({
      transport: await ExtensionTransport.connectTab(tabId),
      defaultViewport: null,
      protocol: 'cdp',
    })

    const [page] = await browser.pages()
    if (!page) {
      await browser.disconnect()
      throw new Error(`Unable to acquire page for tab ${tabId}`)
    }

    this.browsersByTabId.set(tabId, browser)
    this.pagesByTabId.set(tabId, page)
  }

  async detachFromTab(tabId: number): Promise<void> {
    const browser = this.browsersByTabId.get(tabId)
    this.pagesByTabId.delete(tabId)
    this.browsersByTabId.delete(tabId)

    if (!browser) {
      return
    }

    try {
      await browser.disconnect()
    } catch {
    }
  }

  getPage(tabId: number): PuppeteerPage | undefined {
    return this.pagesByTabId.get(tabId)
  }

  isAttached(tabId: number): boolean {
    return this.pagesByTabId.has(tabId)
  }

  async clickElement(tabId: number, selector: string): Promise<void> {
    const page = this.requirePage(tabId)
    await page.click(selector)
  }

  async typeText(tabId: number, selector: string, text: string): Promise<void> {
    const page = this.requirePage(tabId)
    await page.type(selector, text)
  }

  async fillForm(tabId: number, fields: Record<string, FillableValue>): Promise<{ filled: number }> {
    const page = this.requirePage(tabId)
    let filled = 0

    for (const [selector, rawValue] of Object.entries(fields)) {
      const value = rawValue == null ? '' : String(rawValue)
      const handle = await page.$(selector)
      if (!handle) {
        continue
      }

      const tagName = await handle.evaluate((el: Element) => el.tagName.toLowerCase())
      if (tagName === 'select') {
        await page.select(selector, value)
        filled += 1
        continue
      }

      const inputType = await handle.evaluate((el: Element) => {
        if (el instanceof HTMLInputElement) {
          return el.type.toLowerCase()
        }
        return ''
      })

      if (inputType === 'checkbox' || inputType === 'radio') {
        const shouldCheck = value === 'true' || value === '1' || value.toLowerCase() === 'on'
        if (shouldCheck) {
          await page.check(selector)
        } else {
          await page.uncheck(selector)
        }
        filled += 1
        continue
      }

      await page.click(selector, { clickCount: 3 })
      await page.type(selector, value)
      filled += 1
    }

    return { filled }
  }

  async selectOption(tabId: number, selector: string, value: string): Promise<string[]> {
    const page = this.requirePage(tabId)
    return page.select(selector, value)
  }

  async scrollTo(tabId: number, target: ScrollTarget): Promise<{ scrollX: number; scrollY: number }> {
    const page = this.requirePage(tabId)

    return page.evaluate((innerTarget: ScrollTarget) => {
      const behavior = typeof innerTarget === 'object' && innerTarget !== null ? innerTarget.behavior ?? 'smooth' : 'smooth'

      if (innerTarget === 'top') {
        window.scrollTo({ top: 0, behavior })
      } else if (innerTarget === 'bottom') {
        window.scrollTo({ top: document.documentElement.scrollHeight, behavior })
      } else if (innerTarget === 'up') {
        window.scrollBy({ top: -window.innerHeight * 0.8, behavior })
      } else if (innerTarget === 'down') {
        window.scrollBy({ top: window.innerHeight * 0.8, behavior })
      } else if (typeof innerTarget === 'string') {
        const element = document.querySelector(innerTarget)
        if (!element) {
          throw new Error(`Element not found: ${innerTarget}`)
        }
        element.scrollIntoView({ behavior, block: 'center' })
      } else {
        if (innerTarget.selector) {
          const element = document.querySelector(innerTarget.selector)
          if (!element) {
            throw new Error(`Element not found: ${innerTarget.selector}`)
          }
          element.scrollIntoView({ behavior, block: 'center' })
        } else {
          window.scrollTo({
            left: innerTarget.x ?? window.scrollX,
            top: innerTarget.y ?? window.scrollY,
            behavior,
          })
        }
      }

      return { scrollX: window.scrollX, scrollY: window.scrollY }
    }, target)
  }

  async extractText(tabId: number, selector: string): Promise<{ count: number; results: string[] }> {
    const page = this.requirePage(tabId)
    const results = await page.$$eval(selector, (elements: Element[]) =>
      elements
        .map((element: Element) => element.textContent?.trim() ?? '')
        .filter((text: string) => text.length > 0),
    )

    return { count: results.length, results }
  }

  async analyzePage(tabId: number): Promise<Record<string, unknown>> {
    const page = this.requirePage(tabId)

    return page.evaluate(() => {
      const headingCount = document.querySelectorAll('h1,h2,h3,h4,h5,h6').length
      const interactiveCount = document.querySelectorAll('a,button,input,select,textarea,[role="button"]').length

      return {
        url: window.location.href,
        title: document.title,
        readyState: document.readyState,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        counts: {
          headings: headingCount,
          links: document.querySelectorAll('a').length,
          forms: document.querySelectorAll('form').length,
          images: document.querySelectorAll('img').length,
          interactive: interactiveCount,
        },
      }
    })
  }

  async findElements(tabId: number, query: FindElementsQuery): Promise<{ count: number; results: any[] }> {
    const page = this.requirePage(tabId)
    const queryPayload = typeof query === 'string' ? { query, by: 'any' as const, limit: 20 } : query

    const results = await page.evaluate(
      ({ query: innerQuery, by = 'any', limit = 20 }: { query: string; by?: 'text' | 'aria' | 'role' | 'any'; limit?: number }) => {
        const term = innerQuery.trim().toLowerCase()
        const all = Array.from(document.querySelectorAll<HTMLElement>('*'))
        const output: Array<{ selector: string; tag: string; text: string; ariaLabel: string | null; role: string | null }> = []

        const selectorOf = (element: Element): string => {
          if (element.id) return `#${CSS.escape(element.id)}`
          const classPart = element.classList.length > 0 ? `.${Array.from(element.classList).slice(0, 2).map(CSS.escape).join('.')}` : ''
          return `${element.tagName.toLowerCase()}${classPart}`
        }

        for (const element of all) {
          if (output.length >= limit) break

          const rect = element.getBoundingClientRect()
          const visible = rect.width > 0 && rect.height > 0
          if (!visible) continue

          const text = element.textContent?.trim() ?? ''
          const ariaLabel = element.getAttribute('aria-label')
          const role = element.getAttribute('role')

          const matchesText = text.toLowerCase().includes(term)
          const matchesAria = (ariaLabel ?? '').toLowerCase().includes(term)
          const matchesRole = (role ?? '').toLowerCase().includes(term)
          const match = by === 'text' ? matchesText : by === 'aria' ? matchesAria : by === 'role' ? matchesRole : matchesText || matchesAria || matchesRole

          if (!match) continue

          output.push({
            selector: selectorOf(element),
            tag: element.tagName.toLowerCase(),
            text: text.slice(0, 200),
            ariaLabel,
            role,
          })
        }

        return output
      },
      queryPayload,
    )

    return { count: results.length, results }
  }

  async getPageState(tabId: number): Promise<{ url: string; title: string; readyState: DocumentReadyState }> {
    const page = this.requirePage(tabId)
    return {
      url: page.url(),
      title: await page.title(),
      readyState: await page.evaluate(() => document.readyState),
    }
  }

  async takeScreenshot(tabId: number): Promise<string> {
    const page = this.requirePage(tabId)
    const screenshot = await page.screenshot({ encoding: 'base64', type: 'jpeg', quality: 80 })
    return screenshot as string
  }

  async waitForElement(tabId: number, selector: string, timeout = 10000): Promise<boolean> {
    const page = this.requirePage(tabId)
    const handle = await page.waitForSelector(selector, { timeout })
    return Boolean(handle)
  }

  async navigateTo(tabId: number, url: string): Promise<{ url: string; status: number | null }> {
    const page = this.requirePage(tabId)
    const response = await page.goto(url)
    return {
      url: page.url(),
      status: response?.status() ?? null,
    }
  }

  private requirePage(tabId: number): PuppeteerPage {
    const page = this.pagesByTabId.get(tabId)
    if (!page) {
      throw new Error(`Tab ${tabId} is not attached`)
    }
    return page
  }

  private registerDetachHandlers(): void {
    const chromeApi = (globalThis as typeof globalThis & { chrome?: any }).chrome
    if (!chromeApi?.debugger?.onDetach || !chromeApi?.tabs?.onRemoved) {
      return
    }

    chromeApi.debugger.onDetach.addListener((source: { tabId?: number }, reason: string) => {
      const detachedTabId = source?.tabId
      if (typeof detachedTabId !== 'number') {
        return
      }

      this.pagesByTabId.delete(detachedTabId)
      this.browsersByTabId.delete(detachedTabId)

      if (reason === 'canceled_by_user') {
        return
      }
    })

    chromeApi.tabs.onRemoved.addListener((removedTabId: number) => {
      void this.detachFromTab(removedTabId)
    })
  }

  private async assertControllableTab(tabId: number): Promise<void> {
    const chromeApi = (globalThis as typeof globalThis & { chrome?: any }).chrome
    if (!chromeApi?.tabs?.get || !chromeApi?.runtime?.getURL) {
      return
    }

    const tab = await chromeApi.tabs.get(tabId)
    const tabUrl = String(tab?.url ?? '')
    const extensionUrlPrefix = chromeApi.runtime.getURL('')

    if (tabUrl.startsWith(extensionUrlPrefix)) {
      throw new Error(`Refusing to attach to extension tab ${tabId}`)
    }
  }
}
