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
  bot.on('message', (ctx) => checkHandler.handleMessage(ctx))
  bot.command('echo', (ctx) => {
    ctx.reply(ctx.text)
  })

  return {
    dispose: () => checkerSvc.dispose()
  }
}
