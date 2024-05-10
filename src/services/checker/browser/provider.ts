import puppeteer, { type Browser, type Page } from 'puppeteer'
import { parse } from 'date-fns'
import { STATUS_CODES } from 'http'

import {
  type RequestId,
  type StatusProvider,
  type DocumentCheckParams,
  type DocumentStatusHandler,
  QueryError,
  ErrorType,
} from '../types.ts'
import { logger } from '../../../app/logger.ts'
import { type FormParams, type CheckerResponse, DATE_FORMAT, buildFormObject } from './types.ts'

// TS hack
interface CustomWindow extends Window {
  __queryStatus__: (r: { id: RequestId, formObject: FormParams, req: DocumentCheckParams }) => Promise<void>
  __onError__: (id: RequestId, errType: 'internal' | 'http', msg: string) => void
  __onResult__: (id: RequestId, req: DocumentCheckParams, rsp: CheckerResponse) => void
}
declare var window: CustomWindow

const REQ_TIMEOUT_MS = 10000
const PAGE_URL = 'https://pasport.org.ua/solutions/checker'
const CHROME_ARGS = ['--no-sandbox', '--disable-setuid-sandbox']
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0'

export interface BrowserProviderConfig {
  maxPoolSize: number
  headless?: boolean
  chromeArgs?: string[]
}

export class BrowserStatusProvider implements StatusProvider {
  private handler?: DocumentStatusHandler
  private pool: Page[] = []
  private vacantPages: number
  private timeouts = new Map<RequestId, NodeJS.Timeout>()

  private constructor(private browser: Browser, maxPoolSize: number) {
    this.vacantPages = maxPoolSize
  }

  setStatusHandler(h: DocumentStatusHandler) {
    this.handler = h
  }

  async queryDocumentStatus(reqId: RequestId, p: DocumentCheckParams) {
    logger.info(p, 'Got document query request')
    if (this.timeouts.has(reqId)) {
      this.handler?.handleStatusError(reqId, new QueryError(ErrorType.QuotaError, 'Another request is already in progress'))
      return
    }

    let page: Page
    try {
      page = await this.requestPage()
      const timer = setTimeout(() => {
        if (!this.timeouts.has(reqId)) {
          return
        }

        this.handler?.handleStatusError(reqId, new QueryError(ErrorType.TimeoutError, 'Timeout exceeded'))
        this.timeouts.delete(reqId)
      }, REQ_TIMEOUT_MS)

      this.timeouts.set(reqId, timer)
      const formObject = buildFormObject(p)
      await page.evaluate((args) => {
        window.__queryStatus__(args).catch(err => window.__onError__(args.id, 'internal', err.toString()))
      }, { id: reqId, formObject, req: p })

    } catch (err) {
      this.handler?.handleStatusError(reqId, err as QueryError)
    } finally {
      this.returnPage(page)
    }
  }

  private onResult(reqId: RequestId, req: DocumentCheckParams, data: CheckerResponse) {
    logger.debug({ reqId, req }, 'Got document check result')
    const t = this.timeouts.get(reqId)
    if (t) {
      clearTimeout(t)
      this.timeouts.delete(reqId)
    }

    const meta = data['0']
    if (meta.errorCode > 0) {
      this.handler?.handleStatusError(reqId, new QueryError(ErrorType.ApiError, data.send_status_msg))
      return
    }

    const date = parse(meta.statusDate, DATE_FORMAT, new Date())
    this.handler?.handleStatusResult(reqId, {
      updatedAt: date,
      code: meta.status,
      message: data.send_status_msg,
      request: req,
    })
  }

  private onError(reqId: RequestId, type: 'internal' | 'http', msg: string) {
    const t = this.timeouts.get(reqId)
    if (t) {
      clearTimeout(t)
      this.timeouts.delete(reqId)
    }

    const err = new QueryError(type === 'internal' ? ErrorType.CrawlError : ErrorType.HttpError, msg)
    this.handler?.handleStatusError(reqId, err)
  }

  private async requestPage(): Promise<Page> {
    if (!this.vacantPages) {
      throw new QueryError(ErrorType.QuotaError, 'Please try again later')
    }

    let page = this.pool.pop()
    if (page && !page.isClosed) {
      logger.debug('reusing existing page instance')
      this.vacantPages--
      return page
    }

    // Page not created yet
    page = await this.createPage()
    this.vacantPages--
    return page
  }

  private returnPage(p?: Page) {
    if (!p) {
      return
    }
    this.pool.push(p)
    this.vacantPages++
  }

  private async createPage() {
    const page = await this.browser.newPage()
    page.setUserAgent(UA)

    logger.debug('Spawning a new page')
    try {
      const rsp = await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' })
      if (!rsp.ok()) {
        const status = rsp.status()

        // Puppeteer sometimes return empty value
        const statusText = rsp.statusText() || STATUS_CODES[status]
        throw new QueryError(ErrorType.HttpError, `${status} ${statusText}`)
      }

      // Post form data in a browser to bypass CF and capture results in callbacks as Puppeteer can't return promises.
      await page.waitForSelector('form[data-jtoken]', { timeout: 10000 })
      await page.exposeFunction('__onResult__', (reqId, req, rsp) => this.onResult(reqId, req, rsp))
      await page.exposeFunction('__onError__', (reqId, t, err) => this.onError(reqId, t, err))
      await page.evaluate(() => {
        window.__queryStatus__ = async ({ formObject, id, req }) => {
          const token = document.querySelector('form[data-jtoken]')?.getAttribute('data-jtoken')
          if (!token) {
            window.__onError__(id, 'internal', 'CSRF token not found on page.')
            return
          }

          const form = new FormData()
          Object.entries(formObject).forEach(([k, v]) => {
            form.append(k, v)
          })
          form.append(token, '1')

          try {
            const rsp = await fetch(window.location.toString(), {
              method: 'POST',
              body: form,
            })

            if (!rsp.ok) {
              window.__onError__(id, 'http', `${rsp.status} ${rsp.statusText}`)
              return
            }

            const data: CheckerResponse = await rsp.json()
            window.__onResult__(id, req, data)
          } catch (err) {
            window.__onError__(id, 'http', err.message ?? err.toString())
          }
        }
      })
      return page
    } catch (err) {
      page.close()
      throw err
    }
  }

  static async create({ maxPoolSize, headless = true, chromeArgs = CHROME_ARGS }) {
    logger.info({ headless, maxPoolSize, chromeArgs }, 'Starting Chrome browser...')
    const browser = await puppeteer.launch({
      headless,
      args: chromeArgs
    })

    const instance = new BrowserStatusProvider(browser, maxPoolSize)
    return instance
  }

  async dispose() {
    logger.info('Closing browser...')
    this.pool.length = 0
    return await this.browser.close()
  }
}
