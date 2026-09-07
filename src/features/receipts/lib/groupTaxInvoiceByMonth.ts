import type { TaxInvoiceRow } from '../types/tables'

export interface TaxInvoiceMonthGroup {
  month: string // 'YYYY-MM'
  rows: TaxInvoiceRow[]
  // entries 배열(전체 draft) 안에서 각 rows[i]가 실제로 위치한 인덱스.
  // 월별로 나뉜 화면에서 수정/삭제 시 전체 배열의 올바른 항목을 가리키기 위해 필요하다.
  globalIndices: number[]
}

// 작성일자(writtenDate) 기준 'YYYY-MM'으로 그룹핑한다. writtenDate가 비어있는 행(예: 방금 추가한
// 빈 행)은 어떤 월에도 속하지 않으므로 "전체" 보기에서만 보인다.
export function groupTaxInvoiceRowsByMonth(rows: TaxInvoiceRow[]): TaxInvoiceMonthGroup[] {
  const byMonth = new Map<string, { row: TaxInvoiceRow; globalIndex: number }[]>()

  rows.forEach((row, globalIndex) => {
    const month = row.writtenDate.slice(0, 7)
    if (!month) return
    const list = byMonth.get(month) ?? []
    list.push({ row, globalIndex })
    byMonth.set(month, list)
  })

  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, items]) => ({
      month,
      rows: items.map((it) => it.row),
      globalIndices: items.map((it) => it.globalIndex),
    }))
}
