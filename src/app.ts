import Fastify from 'fastify'
import { Telegraf } from 'telegraf'

import { config, getWebhookPath, version } from './app/config/config.ts'
import { logger } from './app/logger.ts'
import { bootstrapService } from './app/app.ts'

const start = async () => {
  try {
    config.validate({ allowed: 'strict' })
    logger.info('Starting bot server...')
    const bot = new Telegraf(config.get('telegram.botToken'))

    const { domain, path } = getWebhookPath()
    const webhook = await bot.createWebhook({
      domain,
      path
    })

    const server = Fastify({
      logger: logger as any,
    })

    server.get('/ping', async (request, reply) => {
      return { ok: true, version }
    })

    server.post(path, async (req, res) => {
      // I hate typescript
      return await webhook(req as any, res.raw)
    })

    const { dispose } = await bootstrapService(bot)
    process.on('exit', dispose)

    const port = config.get('port')
    await server.listen({ port })
    logger.info(`Listening on port ${port}...`)
    logger.info(`Webhook path is ${path}`)

  } catch (err) {
    logger.error(err)
    process.exit(1)
  }
}

await start()

process.on('exit', (code) => {
  logger.info(`Server restarting. Code:${code}`)
});

// this is the signal that nodemon uses
process.once('SIGUSR2', () => {
  logger.info('Server restarting')
  process.kill(process.pid, 'SIGUSR2')
});
