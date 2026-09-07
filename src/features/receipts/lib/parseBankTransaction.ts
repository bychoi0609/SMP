import { cellText, parseAmount, parseDateOnly } from './format'
import type { BankTransaction } from '../types/bankTransaction'

// 통장내역조회 원본 컬럼 인덱스 (0-based), samples/거래내역조회_통장내역.xlsx 기준.
const COL = {
  dateTime: 1,
  withdrawal: 2,
  deposit: 3,
  description: 5,
  counterpartyAccountHolder: 12,
} as const

function isBlankRow(row: string[] | undefined): boolean {
  return !row || row.every((cell) => cellText(cell) === '')
}

// PRD 7.3 파싱 규칙 구현 (헤더는 detectSheetKind가 찾아준 headerRowIndex를 그대로 사용).
export function parseBankTransactionRows(rows: string[][], headerRowIndex: number): BankTransaction[] {
  const dataRows = rows.slice(headerRowIndex + 1).filter((r) => !isBlankRow(r))

  return dataRows.map((r) => ({
    dateOnly: parseDateOnly(r[COL.dateTime]),
    withdrawal: parseAmount(r[COL.withdrawal]),
    deposit: parseAmount(r[COL.deposit]),
    description: cellText(r[COL.description]),
    counterpartyAccountHolder: cellText(r[COL.counterpartyAccountHolder]),
  }))
}
