export enum DocumentStatus {
  Shipped = 21,     // Відправлено до центру до Персоналізації
  InTransit = 23,   // Документ в дорозі до ДП Документ
  Ready = 24,       // Готовий до видачі, приїхав
}

export interface DocumentCheckParams {
  series?: string
  number: string
}
