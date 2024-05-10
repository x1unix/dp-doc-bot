import { minutesToMilliseconds, hoursToMilliseconds } from 'date-fns'

import { BrowserStatusProvider } from './browser/provider.ts';
import { StatusCacheMiddleware } from './cache.ts';
import type { DocumentCheckParams, DocumentStatusHandler, StatusProvider, RequestId } from './types.ts';
import { config } from '../../app/config/config.ts';

const TTL = hoursToMilliseconds(4)
const CLEAR_INTERVAL = minutesToMilliseconds(30)

export class StatusCheckerService {
  private statusProvider: StatusProvider

  protected constructor(rootProvider: StatusProvider) {
    this.statusProvider = new StatusCacheMiddleware(rootProvider, {
      ttl: TTL,
      clearInterval: CLEAR_INTERVAL,
    })
  }

  setStatusHandler(handler: DocumentStatusHandler) {
    this.statusProvider.setStatusHandler(handler)
  }

  static async create() {
    const browserProvider = await BrowserStatusProvider.create({
      maxPoolSize: config.get('chrome.pagePoolSize'),
      headless: config.get('chrome.headless'),
      chromeArgs: config.get('chrome.args')
    })

    return new StatusCheckerService(browserProvider)
  }

  async queryDocumentStatus(reqId: RequestId, p: DocumentCheckParams) {
    return await this.statusProvider.queryDocumentStatus(reqId, p)
  }

  async dispose() {
    return await this.statusProvider.dispose()
  }
}
