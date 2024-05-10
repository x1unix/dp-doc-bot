import type { StatusCode, DocumentCheckParams } from '../types.ts'

export const DATE_FORMAT = 'dd.MM.yyyy'

export enum ServiceType {
  Passport = '2'
}

export enum IdentityDocument {
  LegacyPassport = '1',
  ID = '2'
}

export interface FormParams {
  doc_service: string
  doc_1_select: string
  doc_1_series: string
  doc_1_number6: string
  doc_1_number9: string
  doc_age: string
  doc_2_select: string
  doc_2_series: string
  doc_2_number6: string
  doc_2_number9: string
  doc_other: string
}

export interface CheckerResponse extends FormParams {
  "0": StatusInfo
  status: number
  msg?: string
  send_status_msg: string
  docType: string
  docSeries: string
  docNumber: string
  docFor: string
  docHash: string
  dpd: string
}

export interface StatusInfo {
  statusDate: string
  status: StatusCode
  office: number
  backoffice: string
  frontoffice: string
  errorCode?: number
}

export const buildFormObject = ({ series, number }: DocumentCheckParams): FormParams => {
  return {
    'doc_service': ServiceType.Passport,
    'doc_1_select': '',
    'doc_1_series': '',
    'doc_1_number6': '',
    'doc_1_number9': '',
    'doc_age': '0',
    'doc_2_select': series ? IdentityDocument.LegacyPassport : IdentityDocument.ID,
    'doc_2_series': series || '',
    'doc_2_number6': series ? number : '',
    'doc_2_number9': series ? '' : number,
    'doc_other': '',
  }
}
