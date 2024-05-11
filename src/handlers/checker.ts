import type { Context, Telegraf } from 'telegraf'

import { logger } from '../app/logger.ts'
import { StatusCheckerService } from '../services/checker/service.ts'
import {
  ErrorType,
  QueryError,
  type DocumentStatusHandler,
  type DocumentCheckParams,
  type RequestId,
  type DocumentStatus,
  DocumentType
} from '../services/checker/types.ts'

import { EXAMPLES_STRING, formatError, formatResult } from './format.ts'
import { parseDocumentId } from '../utils/parse.ts'

export class CheckerHandler implements DocumentStatusHandler {
  constructor(private bot: Telegraf, private checker: StatusCheckerService) {
    checker.setStatusHandler(this)
  }

  async handleMessage(ctx: Context) {
    const primaryDocument = parseDocumentId(ctx.text)
    if (!primaryDocument) {
      ctx.replyWithHTML(
        '🤔 Вибачте, але я не розумію вас.\n\n' +
        'Вкажіть будь-ласка правильний номер документу, на підставі якого здійснювалось оформлення.' +
        EXAMPLES_STRING
      )
      return
    }

    let searchByStr = ''
    switch (primaryDocument.number) {
      case DocumentType.BirthCertificate:
        searchByStr = 'за свідоцтвом про народження'
        break
      case DocumentType.ID:
        searchByStr = 'за айді-карткою'
        break
      case DocumentType.LegacyPassport:
        searchByStr = 'за паспортом-книжечкою'
        break
    }

    try {
      ctx.reply(`🔍 Шукаю інформацію ${searchByStr}, зачекайте будь-ласка...`)
      await this.checker.queryDocumentStatus(ctx.msg.chat.id, { primaryDocument })
    } catch (err: any) {
      this.handleStatusError(ctx.msg.chat.id, QueryError.from(err))
    }
  }

  async handleStatusResult(reqId: number, s: DocumentStatus) {
    try {
      const msg = formatResult(s)
      await this.bot.telegram.sendMessage(reqId, msg, { parse_mode: 'HTML' })
    } catch (err) {
      logger.error(err)
    }
  }

  handleStatusError(id: RequestId, err: QueryError) {
    if (err.type === ErrorType.ApiError) {
      logger.warn(err)
    } else {
      logger.error(err)
    }

    const msg = formatError(err)
    this.bot.telegram.sendMessage(id, msg, { parse_mode: 'HTML' })
      .catch(err => logger.error(`Failed to send reply: ${err}`))
  }
}
