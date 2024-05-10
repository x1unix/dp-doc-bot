import type { Telegraf } from 'telegraf'

import { StatusCheckerService } from 'src/services/checker/service.ts'
import { startHandler, CheckerHandler } from '../handlers/handlers.ts'

export const bootstrapService = async (
  bot: Telegraf,
) => {
  const checkerSvc = await StatusCheckerService.create()
  const checkHandler = new CheckerHandler(bot, checkerSvc)

  bot.start(startHandler)
  bot.help(startHandler)
  bot.command('echo', (ctx) => {
    ctx.reply(ctx.payload)
  })
  bot.on('message', (ctx) => checkHandler.handleMessage(ctx))

  return {
    dispose: async () => checkerSvc.dispose()
  }
}
