import { cellText, parseAmount, parseDateOnly } from './format'
import type { ReceiptRow } from '../types/tables'
import { cardSheetName, type CardMasterEntry } from '../data/cardMaster'

// 카드사 매출내역(영수증) 원본 컬럼 인덱스 (0-based), samples/매출내역_일반(카드사).xls 기준.
const COL = {
  cardNo: 1,
  usageDate: 3,
  merchantName: 4,
  supplyAmount: 5,
  taxAmount: 6,
  totalAmount: 8,
  taxType: 18,
} as const

function isBlankRow(row: string[] | undefined): boolean {
  return !row || row.every((cell) => cellText(cell) === '')
}

export function extractCardLast4(cardNoRaw: string): string {
  const digitsOnly = cardNoRaw.replace(/[^0-9]/g, '')
  return digitsOnly.slice(-4)
}

export interface ReceiptEntry {
  last4: string
  row: ReceiptRow
}

// PRD 7.2.3 입력 → 출력 매핑 규칙 구현 (카드별 분리는 groupReceiptsByCard에서 처리).
export function parseReceiptRows(rows: string[][], headerRowIndex: number): ReceiptEntry[] {
  const dataRows = rows.slice(headerRowIndex + 1).filter((r) => !isBlankRow(r))

  return dataRows
    .map((r) => {
      const last4 = extractCardLast4(cellText(r[COL.cardNo]))
      const row: ReceiptRow = {
        date: parseDateOnly(r[COL.usageDate]),
        merchantName: cellText(r[COL.merchantName]),
        supplyAmount: parseAmount(r[COL.supplyAmount]),
        taxAmount: parseAmount(r[COL.taxAmount]),
        totalAmount: parseAmount(r[COL.totalAmount]),
        siteName: '',
        description: '',
        accountCode: '',
        siteCode: null,
        taxType: cellText(r[COL.taxType]),
        detail: '',
      }
      return { last4, row }
    })
    .filter((entry) => entry.last4 !== '')
}

export interface ReceiptSheet {
  last4: string
  name: string
  rows: ReceiptRow[]
  // entries 배열(전역 상태) 안에서 각 rows[i]가 실제로 위치한 인덱스.
  // 카드별로 나뉜 화면에서 수정/삭제 시 전역 배열의 올바른 항목을 가리키기 위해 필요하다.
  globalIndices: number[]
}

export interface ReceiptGrouping {
  sheets: ReceiptSheet[]
  unregisteredLast4: string[]
}

// 카드 마스터 목록 기준으로 카드별 시트를 만든다. 이번 업로드에 내역이 없는 카드는 제외한다.
// 마스터에 없는 카드번호는 별도로 보고한다 (FR-5 연동).
export function groupReceiptsByCard(
  entries: ReceiptEntry[],
  cardMaster: CardMasterEntry[],
): ReceiptGrouping {
  const knownLast4 = new Set(cardMaster.map((c) => c.last4))
  const byLast4 = new Map<string, { row: ReceiptRow; globalIndex: number }[]>()

  entries.forEach(({ last4, row }, globalIndex) => {
    const list = byLast4.get(last4) ?? []
    list.push({ row, globalIndex })
    byLast4.set(last4, list)
  })

  const sheets: ReceiptSheet[] = cardMaster
    .map((entry) => {
      const items = byLast4.get(entry.last4) ?? []
      return {
        last4: entry.last4,
        name: cardSheetName(entry),
        rows: items.map((it) => it.row),
        globalIndices: items.map((it) => it.globalIndex),
      }
    })
    .filter((sheet) => sheet.rows.length > 0)

  const unregisteredLast4 = [...byLast4.keys()].filter((last4) => !knownLast4.has(last4))

  return { sheets, unregisteredLast4 }
}
