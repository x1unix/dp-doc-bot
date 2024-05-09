import Fastify from 'fastify'
import { Telegraf } from 'telegraf'

import { config, getWebhookPath, version } from './app/config/config.ts'
import { logger, Sentry } from './app/logger.ts'
import { bootstrapService } from './app/app.ts'
import { retry, sleep } from './app/utils.ts'

const start = async () => {
  try {
    config.validate({ allowed: 'strict' })
  } catch (err) {
    console.error(`Invalid config: ${err}`)
    Sentry.captureException(err)
    process.exit(1)
    return
  }

  try {
    logger.info('Starting bot server...')
    const bot = new Telegraf(config.get('telegram.botToken'))
    const secret = config.get('telegram.webhookSecret')
    const { domain, path, url } = getWebhookPath(bot.secretPathComponent())
    const webhook = await bot.createWebhook({
      domain,
      path
    })

    bot.botInfo ??= await bot.telegram.getMe()
    logger.info(`Starting bot @${bot.botInfo.username}...`)

    // Fails on first run and needs retry after 1s.
    if (config.get('telegram.updateWebhookOnStart')) {
      logger.info('Updating hook URL...')
      await retry(3)(() => bot.telegram.setWebhook(url, {
        secret_token: secret,
      }))
    }

    const server = Fastify({
      logger: false,
    })

    server.get('/ping', async (request, reply) => {
      return { ok: true, version }
    })

    server.post(path, async (req, res) => {
      const reqToken = req.headers['x-telegram-bot-api-secret-token']
      if (reqToken !== secret) {
        res.status(404).send({ message: 'Not Found' })
        return
      }

      // I hate typescript
      return await webhook(req as any, res.raw)
    })

    const { dispose } = await bootstrapService(bot)
    process.on('exit', () => dispose())

    const port = config.get('port')
    await server.listen({ port })
    logger.info(`Listening on port ${port}...`)
    logger.info(`Webhook path is ${url}`)

  } catch (err) {
    await logger.error(err)
    await logger.flush()

    // Sleep to flush sentry spans
    if (config.get('sentry.dsn')) {
      await sleep(1000)
    }

    process.exit(1)
  }

}

await start()

// this is the signal that nodemon uses
process.once('SIGUSR2', () => {
  logger.info('Server restarting')
  process.kill(process.pid, 'SIGUSR2')
});
