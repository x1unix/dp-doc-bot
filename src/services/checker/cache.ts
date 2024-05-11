import { differenceInMilliseconds } from 'date-fns'
import { type RequestId, type DocumentCheckParams, type DocumentStatusHandler, type StatusProvider, type DocumentStatus, type QueryError, DocumentType } from './types.ts'

interface CacheEntry {
  createdAt: Date
  value: DocumentStatus
}

interface Config {
  ttl: number
  clearInterval: number
}

export class StatusCacheMiddleware implements StatusProvider, DocumentStatusHandler {
  private handler?: DocumentStatusHandler
  private cleanTimer?: NodeJS.Timeout
  private cache = new Map<string, CacheEntry>()

  constructor(private provider: StatusProvider, private config: Config) {
    provider.setStatusHandler(this)
    this.scheduleCleanup()
  }

  queryDocumentStatus(reqId: RequestId, p: DocumentCheckParams): Promise<void> {
    const cached = this.getFromCache(p)
    if (cached) {
      this.handler.handleStatusResult(reqId, cached)
      return
    }

    return this.provider.queryDocumentStatus(reqId, p)
  }

  setStatusHandler(h: DocumentStatusHandler) {
    this.handler = h
    this.provider.setStatusHandler(this)
  }

  async dispose() {
    if (this.cleanTimer) {
      clearTimeout(this.cleanTimer)
    }

    this.cache.clear()
    return await this.provider.dispose()
  }

  handleStatusResult(reqId: RequestId, s: DocumentStatus) {
    const key = this.getCacheKey(s.request)
    this.cache.set(key, {
      createdAt: new Date(),
      value: s,
    })

    this.handler?.handleStatusResult(reqId, s)
  }

  handleStatusError(reqId: RequestId, err: QueryError) {
    this.handler?.handleStatusError(reqId, err)
  }

  private getCacheKey({ primaryDocument: docRef }: DocumentCheckParams) {
    const { type, number } = docRef

    switch (type) {
      case DocumentType.ID:
        return `ID:${number}`
      case DocumentType.BirthCertificate:
        return `BC:${docRef.series}${number}`
      case DocumentType.LegacyPassport:
        return `PS:${docRef.series}${number}`
    }
  }

  private isTtlElapsed(createdAt: Date, now = new Date()) {
    const diff = differenceInMilliseconds(createdAt, now)
    return diff >= this.config.ttl
  }

  private getFromCache(p: DocumentCheckParams) {
    const key = this.getCacheKey(p)
    const entry = this.cache.get(key)
    if (!entry) {
      return null
    }

    const { createdAt, value } = entry
    if (this.isTtlElapsed(createdAt)) {
      this.cache.delete(key)
      return null
    }

    return value
  }

  private scheduleCleanup() {
    const cleanupFunc = () => {
      const now = new Date()
      this.cache.forEach(({ createdAt }, key) => {
        if (this.isTtlElapsed(createdAt, now)) {
          this.cache.delete(key)
        }
      })

      this.cleanTimer = setTimeout(cleanupFunc, this.config.clearInterval)
    }

    cleanupFunc()
  }
}
