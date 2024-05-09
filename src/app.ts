import Fastify from 'fastify'
import { Telegraf } from 'telegraf'

import { config, getWebhookPath, version } from './app/config/config.ts'
import { logger, bootstrapLogger } from './app/logger.ts'
import { bootstrapService } from './app/app.ts'
import { retry } from './app/utils.ts'

const start = async () => {
  try {
    config.validate({ allowed: 'strict' })
    bootstrapLogger()
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
      const reqToken = req.headers['X-Telegram-Bot-Api-Secret-Token']
      if (reqToken !== secret) {
        res.status(400).send({ message: 'Bad Request' })
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
    logger.error(err)
    process.exit(1)
  }
}

await start()

// this is the signal that nodemon uses
process.once('SIGUSR2', () => {
  logger.info('Server restarting')
  process.kill(process.pid, 'SIGUSR2')
});
