import type { Context } from 'telegraf'

import { EXAMPLES_STRING } from './format.ts'

export const startHandler = (ctx: Context) => {
  ctx.replyWithHTML(
    'Привіт! 👋\n\nЦей бот дозволяє швидко відслідковувати стан готовності закордонних паспортів.\n' +
    'Просто відправ номер документу, на підставі якого здійснювалось оформлення.' +
    EXAMPLES_STRING +
    `\n⚠️ Це неофіційний бот та не повʼязаний з ДП Документ.\nБот є анонімним та не зберігає ваші дані.`
  )
}
