import convict from 'convict'

import { autoload } from './autoload.ts'

autoload()

const { NODE_ENV = 'dev', APP_VERSION = '1.0.0', ENV } = process.env

export const isProduction = NODE_ENV.startsWith('prod')
export const version = APP_VERSION

export const config = convict({
  env: {
    doc: 'Application environment',
    format: ['prod', 'production', 'dev', 'development', 'test'],
    default: 'dev',
    env: 'NODE_ENV',
  },
  port: {
    doc: 'HTTP port address',
    format: 'port',
    default: 8080,
    env: 'HTTP_PORT',
  },
  baseUrl: {
    doc: 'Base URL for webhook',
    format: 'url',
    env: 'HTTP_BASE_URL',
    default: null,
  },
  telegram: {
    botToken: {
      doc: 'Bot token',
      format: 'required-string',
      env: 'TELEGRAM_BOT_TOKEN',
      default: null,
    },
    webhookSecret: {
      doc: 'Bot secret for Telegram',
      format: 'required-string',
      env: 'BOT_WEBHOOK_SECRET',
      default: null,
    },
    updateWebhookOnStart: {
      doc: 'Update webhook URL on service start',
      format: 'boolean',
      env: 'BOT_UPDATE_WEBHOOK_ON_BOOT',
      default: false,
    }
  },
  log: {
    level: {
      doc: 'Logging level',
      format: 'log-level',
      env: 'LOG_LEVEL',
      default: isProduction ? 'warn' : 'debug',
    },
  },
  sentry: {
    dsn: {
      doc: 'Sentry DSN',
      format: '*',
      env: 'SENTRY_DSN',
      default: '',
    },
  },
  chrome: {
    headless: {
      doc: 'Start Chrome in headless mode',
      format: 'boolean',
      env: 'CHROME_HEADLESS',
      default: true,
    },
    args: {
      doc: 'Chrome launch command line args',
      format: 'cmd',
      env: 'CHROME_ARGS',
      default: ['--no-sandbox', '--disable-setuid-sandbox']
    },
    pagePoolSize: {
      doc: 'Chrome pages pool limit',
      format: 'int',
      env: 'CHROME_PAGES_POOL_SIZE',
      default: 5,
    }
  }
})

export type Config = typeof config

export const getWebhookPath = (hookEndpoint: string) => {
  const url = new URL(config.get('baseUrl'))
  if (!url.pathname.endsWith('/')) {
    // Normalize URL path
    url.pathname += '/'
  }

  const hookPath = `${url.pathname}${hookEndpoint}`

  return { domain: url.host, path: hookPath, url: `${url.origin}${hookPath}` }
}
