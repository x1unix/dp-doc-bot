import {
  DocumentType,
  type DocumentRef,
} from '../services/checker/types.ts'

const paperIdRegex = /^([А-ЩЬЮЯҐЄІЇ]{2})(\d{6,7})$$/i
const cardIdRegex = /^\d{9}$/


const parseBirthCertID = (text: string): DocumentRef | null => {
  return null
}

/**
 * Parses document ID and returns document query with document ID, series and type.
 *
 * Supported formats:
 *
 * * `І-БК 803319, ЯИ 376986` - Birth certificate.
 * * `НС3456123` - Legacy paper passport.
 * * `000031886` - ID card.
 *
 * @param text ID string
 * @returns
 */
export const parseDocumentId = (text: string): DocumentRef | null => {
  if (text.length > 32) {
    return null
  }

  text = text.trim()
  if (cardIdRegex.test(text)) {
    return { type: DocumentType.ID, number: text }
  }

  const matches = paperIdRegex.exec(text)
  if (matches) {
    const [, series, number] = matches
    return { type: DocumentType.LegacyPassport, series, number }
  }

  return parseBirthCertID(text)
}

export const formatDocumentRef = (ref: DocumentRef) => {
  const { type, number } = ref
  switch (type) {
    case DocumentType.ID:
      return number
    case DocumentType.LegacyPassport:
      return `${ref.series}${number}`
    case DocumentType.BirthCertificate:
      return `${ref.series} ${number}`
  }
}
