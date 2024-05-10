export enum StatusCode {
  Shipped = 21,     // Відправлено до центру до Персоналізації
  InTransit = 23,   // Документ в дорозі до ДП Документ
  Ready = 24,       // Готовий до видачі, приїхав
}

export type RequestId = number

export interface DocumentCheckParams {
  /**
   * Document series. Usually first two letters of a legacy passport.
   */
  series?: string

  /**
   * Document number as ID.
   */
  number: string
}

export interface DocumentStatus {
  /**
   * Last status update date
   */
  updatedAt: Date

  /**
   * Internal status code.
   *
   * More descriptive, as message might be misleading.
   */
  code: StatusCode

  /**
   * User-friendly message, sometimes makes no sense.
   *
   * E.g. document might be delivered according to code by message says it's in transit.
   */
  message: string

  /**
   * Original request used to query information.
   */
  request: DocumentCheckParams
}

export enum ErrorType {
  QuotaError = 1,
  CrawlError = 2,
  HttpError = 3,
  ApiError = 4,
  TimeoutError = 5,
}

export class QueryError extends Error {
  constructor(public type: ErrorType, public message: string) {
    super(message)
  }

  /**
   * Explicitly converts error to QueryError, if error is not QueryError.
   *
   * @param err
   * @returns
   */
  static from(err: any): QueryError {
    if (err instanceof QueryError) {
      return err
    }

    return new QueryError(ErrorType.CrawlError, err.message ?? err.toString())
  }
}

export interface DocumentStatusHandler {
  /**
   * Handles incoming document status messages.
   *
   * @param reqId Request ID.
   * @param s Status, if no error occured.
   */
  handleStatusResult(reqId: RequestId, s: DocumentStatus)

  /**
   * Handles document query error.
   *
   * @param reqId Request ID.
   * @param err
   */
  handleStatusError(reqId: RequestId, err: QueryError)
}

export interface StatusProvider {
  /**
   * Sets a handler for document status results.
   * @param h
   */
  setStatusHandler(h: DocumentStatusHandler)

  /**
   * Schedules a document status check and calls status handler set by `handleStatusResult`.
   *
   * @see setStatusHandler
   * @param reqId Request ID.
   * @param p Request params
   */
  queryDocumentStatus(reqId: RequestId, p: DocumentCheckParams): Promise<void>

  /**
   * Free all allocated resources.
   * @returns
   */
  dispose: () => Promise<void>
}
