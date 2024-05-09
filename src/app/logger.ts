import pino, { type LoggerOptions } from 'pino'
import { createWriteStream, Severity } from 'pino-sentry'

import { config, version } from './config/config.ts'

export { Sentry } from 'pino-sentry'

const bootstrapLogger = () => {
  const logLevel = config.get('log.level')

  const pinoOpts: LoggerOptions = {
    level: logLevel
  }

  const sentryDsn = config.get('sentry.dsn')
  if (!sentryDsn) {
    return pino(pinoOpts, process.stdout)
  }

  const stream = createWriteStream({
    dsn: sentryDsn,
    release: version,
    level: 'error',
    stackAttributeKey: 'err.stack',
    tracesSampleRate: 1.0, //  Capture 100% of the transactions
    profilesSampleRate: 1.0,
    sentryExceptionLevels: [
      Severity.Critical,
      Severity.Error,
      Severity.Fatal,
    ],
    decorateScope(data: any, scope) {
      if (!data.err) {
        return
      }
      const { type, message, stack, ...fields } = data.err
      scope.setExtra('errorData', fields)
    },
  })

  return pino(pinoOpts, pino.multistream([stream, { stream: process.stdout }]))
}

export const logger = bootstrapLogger()
