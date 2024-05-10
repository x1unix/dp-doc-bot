import { format, differenceInCalendarDays } from 'date-fns'
import { uk } from 'date-fns/locale/uk'

import { logger } from '../app/logger.ts'
import { ErrorType, QueryError, type DocumentStatus, StatusCode } from '../services/checker/types.ts'

const DP_DOC_URL = 'https://pasport.org.ua/solutions/checker'
const INTERNAL_ERR_SUFFIX = '\n\nПропоную вам поки в ручному режимі перевірити статус документу на сторінці ДП Документ:\n' +
  DP_DOC_URL

const isValidDate = (date) => date instanceof Date && !isNaN(+date)

export const formatError = (err: any) => {
  const qe = QueryError.from(err)
  let msg: string
  switch (qe.type) {
    case ErrorType.ApiError:
      return `🤷 Я нічого не знайшов, будь-ласка перевірте правильність введених даних.\n` + qe.message
    case ErrorType.QuotaError:
      return '⌛️ Занадто багато запитів. Зачекайте будь-ласка хвилинку поки попередній запит буде обробленно.'
    case ErrorType.TimeoutError:
      return '⌛️ Сервер ДП Документ не відповідає. Спробуйте будь-ласка пізніше або зайдіть на сайт ДП Документ:\n\n' +
        DP_DOC_URL
    case ErrorType.HttpError:
      msg = '🙈 Вибачте, але сервер ДП Документ повернув помилку.'
      break
    case ErrorType.CrawlError:
      msg = '🤯 Вибачте, сталась внутрішня помилка.'
      break
  }

  return msg + '\n\n<code>' + qe.message + '</code>' + INTERNAL_ERR_SUFFIX
}

export const formatResult = ({ code, message, updatedAt, request }: DocumentStatus) => {
  const now = new Date()
  const docId = request.series ? `${request.series}${request.number}` : request.number
  let msg: string
  switch (code) {
    case StatusCode.Shipped:
      msg = `📦 Документ ${docId} відправлено до центру персоналізації`
      break
    case StatusCode.InTransit:
      msg = `🚚 Документ ${docId} в дорозі до ДП Документ.`
      break
    case StatusCode.Ready:
      msg = `✅ Документ ${docId} готовий до видачі!`
      break
    default:
      msg = `ℹ️ Статус документу ${docId} (код ${code}):`
      break
  }

  const diffDays = differenceInCalendarDays(now, updatedAt)
  let diffStr: string

  switch (diffDays) {
    case 0:
      diffStr = 'сьогодні'
      break
    case 1:
      diffStr = 'вчора'
      break
    case 2:
    case 3:
    case 4:
      diffStr = `${diffDays} дні тому`
      break
    default:
      diffStr = `${diffDays} днів тому`
      break
  }

  let dateFmt: string
  try {
    dateFmt = format(updatedAt, 'do MMMM yyyy', { locale: uk })
  } catch (err) {
    logger.error(`Weird date in response - ${err} (value: ${updatedAt})`)
    dateFmt = 'невідомо'
  }

  msg += `\n\n<b>Відповідь від ДП Документ:</b>\n${message}\n\n` +
    `🕒 Дата оновлення статусу: ${dateFmt} (${diffStr})` +
    '\n\n<i>Зверніть увагу, що відповідь від ДП Документ може відрізнятись від реального статусу вашого документу.</i>\n\n'

  return msg
}
