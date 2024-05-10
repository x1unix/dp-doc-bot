import { minutesToMilliseconds, hoursToMilliseconds } from 'date-fns'

import { BrowserStatusProvider } from './browser/provider.ts';
import { StatusCacheMiddleware } from './cache.ts';
import type { DocumentCheckParams, DocumentStatusHandler, StatusProvider, RequestId } from './types.ts';

const MAX_POOL_SIZE = 5
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
      maxPoolSize: MAX_POOL_SIZE
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
