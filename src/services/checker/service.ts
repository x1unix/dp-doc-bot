import { minutesToMilliseconds, hoursToMilliseconds } from 'date-fns'

import { BrowserStatusProvider } from './browser';
import { StatusCacheMiddleware } from './cache';
import type { DocumentCheckParams, DocumentStatusHandler, StatusProvider } from './types';

const MAX_POOL_SIZE = 5
const TTL = hoursToMilliseconds(4)
const CLEAR_INTERVAL = minutesToMilliseconds(30)

export class StatusCheckerService {
  private statusProvider: StatusProvider

  protected constructor(handler: DocumentStatusHandler, rootProvider: StatusProvider) {
    this.statusProvider = new StatusCacheMiddleware(rootProvider, {
      ttl: TTL,
      clearInterval: CLEAR_INTERVAL,
    })

    this.statusProvider.setStatusHandler(handler)
  }

  static async create(handler: DocumentStatusHandler) {
    const browserProvider = await BrowserStatusProvider.create({
      maxPoolSize: MAX_POOL_SIZE
    })

    return new StatusCheckerService(handler, browserProvider)
  }

  async queryDocumentStatus(reqId: string, p: DocumentCheckParams) {
    return await this.statusProvider.queryDocumentStatus(reqId, p)
  }

  dispose() {
    this.statusProvider.dispose()
  }
}
