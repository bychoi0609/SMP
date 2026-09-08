import type { ReceiptEntry } from './parseReceipt'

export interface ReceiptMonthGroup {
  month: string // 'YYYY-MM'
  entries: ReceiptEntry[]
  // entries 배열(전역 상태) 안에서 각 entries[i]가 실제로 위치한 인덱스.
  globalIndices: number[]
}

// 날짜(date) 기준 'YYYY-MM'으로 그룹핑한다. 카드별이 아니라 월별로만 묶어서 보여주는
// "월별 영수증 데이터" 보기 화면 전용 — groupTaxInvoiceRowsByMonth와 동일한 규칙.
export function groupReceiptsByMonth(entries: ReceiptEntry[]): ReceiptMonthGroup[] {
  const byMonth = new Map<string, { entry: ReceiptEntry; globalIndex: number }[]>()

  entries.forEach((entry, globalIndex) => {
    const month = entry.row.date.slice(0, 7)
    if (!month) return
    const list = byMonth.get(month) ?? []
    list.push({ entry, globalIndex })
    byMonth.set(month, list)
  })

  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, items]) => ({
      month,
      entries: items.map((it) => it.entry),
      globalIndices: items.map((it) => it.globalIndex),
    }))
}
