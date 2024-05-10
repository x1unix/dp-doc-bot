import type { Context, Telegraf } from 'telegraf'

import { logger } from '../app/logger.ts'
import { StatusCheckerService } from '../services/checker/service.ts'
import {
  ErrorType,
  QueryError,
  type DocumentStatusHandler,
  type DocumentCheckParams,
  type RequestId,
  type DocumentStatus
} from '../services/checker/types.ts'

import { formatError, formatResult } from './format.ts'

const paperIdRegex = /^([А-ЩЬЮЯҐЄІЇ]{2})(\d{6,7})$$/i
const cardIdRegex = /^\d{9}$/

const parseMessage = (text: string): DocumentCheckParams | null => {
  if (text.length > 32) {
    return null
  }

  text = text.trim()
  if (cardIdRegex.test(text)) {
    return { number: text }
  }

  const matches = paperIdRegex.exec(text)
  if (!matches) {
    return null
  }

  const [, series, number] = matches
  return { series, number }
}

export class CheckerHandler implements DocumentStatusHandler {
  constructor(private bot: Telegraf, private checker: StatusCheckerService) {
    checker.setStatusHandler(this)
  }

  async handleMessage(ctx: Context) {
    const params = parseMessage(ctx.text)
    if (!params) {
      ctx.replyWithHTML(
        '🤔 Вибачте, але я не розумію вас.\n\n' +
        'Номер документу має бути у форматі серії та номеру 📘 паспорту, або номер 💳 айді-картки.\n\n' +
        '<b>Важливо:</b> Серія паспорту має бути <i>кирилицею</i>.'
      )
      return
    }

    try {
      ctx.reply('🔍 Шукаю інформацію, зачекайте будь-ласка...')
      await this.checker.queryDocumentStatus(ctx.msg.chat.id, params)
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
