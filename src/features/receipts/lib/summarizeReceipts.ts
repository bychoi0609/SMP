import type { ReceiptRow } from '../types/tables'

export interface ReceiptGroupSummary {
  key: string // 빈 문자열 = 미지정
  label: string
  count: number
  total: number
}

export interface ReceiptTotals {
  count: number
  supply: number
  tax: number
  total: number
  // 계정과목 또는 세부내역이 비어있는 행 — 자동 입력 규칙에 걸리지 않아 손으로 채워야 하는 행.
  unclassified: number
}

export function summarizeTotals(rows: ReceiptRow[]): ReceiptTotals {
  return rows.reduce<ReceiptTotals>(
    (acc, r) => ({
      count: acc.count + 1,
      supply: acc.supply + r.supplyAmount,
      tax: acc.tax + r.taxAmount,
      total: acc.total + r.totalAmount,
      unclassified: acc.unclassified + (!r.accountCode.trim() || !r.detail.trim() ? 1 : 0),
    }),
    { count: 0, supply: 0, tax: 0, total: 0, unclassified: 0 },
  )
}

// keyOf가 돌려준 값 기준으로 합계금액을 묶고, 금액이 큰 순서로 정렬한다. 빈 키는 '(미지정)'으로 모은다.
export function groupReceiptTotals<T extends ReceiptRow>(
  rows: T[],
  keyOf: (r: T) => string,
  labelOf: (r: T) => string = keyOf,
): ReceiptGroupSummary[] {
  const byKey = new Map<string, ReceiptGroupSummary>()
  for (const r of rows) {
    const key = keyOf(r).trim()
    const group = byKey.get(key) ?? { key, label: key ? labelOf(r) : '(미지정)', count: 0, total: 0 }
    group.count += 1
    group.total += r.totalAmount
    byKey.set(key, group)
  }
  return [...byKey.values()].sort((a, b) => b.total - a.total)
}
