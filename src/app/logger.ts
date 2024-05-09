import { createLogger, transports, format } from 'winston'

import { isProduction } from './config/config.ts'

const transport = new transports.Console({
  stderrLevels: ['warn', 'error'],
})

export const logger = createLogger({
  level: isProduction ? 'warn' : 'info',
  // Define levels required by Fastify (by default has verbose level and does not have trace)
  levels: {
    fatal: 0,
    error: 1,
    warn: 2,
    info: 3,
    trace: 4,
    debug: 5
  },
  transports: [
    transport,
  ],
  exceptionHandlers: [
    transport,
  ],
  rejectionHandlers: [
    transport,
  ],
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.prettyPrint()
  )
})
