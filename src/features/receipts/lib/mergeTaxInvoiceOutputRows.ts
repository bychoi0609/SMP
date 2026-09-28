import type { TaxInvoiceRow } from '../types/tables'
import { renumber } from './applyRowUpdate'

// 세금계산서 모달의 "엑셀 업로드"(다운로드 양식 재업로드)로 들어온 행을 기존 draft에 반영한다.
// 다운로드 양식에는 승인번호가 없으므로 작성일자+거래처사업자번호+합계금액+품목명 조합으로 같은 문서를 찾고,
// 찾으면 엑셀 값을 우선해 덮어쓴다(단, 엑셀 셀이 비어 있는 필드는 기존 값을 유지). 못 찾으면 새 행으로 추가한다.
// 확정된 달(잠긴 행)은 건드리지 않는다.

const OVERRIDE_FIELDS = [
  'writtenDate',
  'counterpartyBizNo',
  'counterpartyName',
  'totalAmount',
  'supplyAmount',
  'taxAmount',
  'itemName',
  'issueType',
  'taxType',
  'accountCode',
  'siteCode',
  'paymentBasisAccount',
  'paymentDate',
  'note',
  'project',
  'detail',
] as const satisfies readonly (keyof TaxInvoiceRow)[]

function contentKey(row: TaxInvoiceRow): string {
  const bizNo = row.counterpartyBizNo.replace(/\D/g, '')
  return `${row.writtenDate}|${bizNo}|${row.totalAmount}|${row.itemName.trim()}`
}

function isEmptyValue(value: unknown): boolean {
  return value === '' || value === null || value === undefined
}

export interface TaxInvoiceOutputMergeResult {
  rows: TaxInvoiceRow[]
  updatedCount: number
  addedCount: number
  skippedLockedCount: number
}

export function mergeTaxInvoiceOutputRows(
  existing: TaxInvoiceRow[],
  incoming: TaxInvoiceRow[],
  confirmedMonths: Set<string>,
): TaxInvoiceOutputMergeResult {
  const merged = [...existing]
  // 같은 키의 행이 여러 개일 수 있으므로(동일 금액·품목의 반복 거래) 키별 인덱스 큐로 하나씩 소비한다.
  const queueByKey = new Map<string, number[]>()
  merged.forEach((row, i) => {
    if (confirmedMonths.has(row.writtenDate.slice(0, 7))) return
    const key = contentKey(row)
    const queue = queueByKey.get(key) ?? []
    queue.push(i)
    queueByKey.set(key, queue)
  })

  let updatedCount = 0
  let addedCount = 0
  let skippedLockedCount = 0

  for (const inc of incoming) {
    if (confirmedMonths.has(inc.writtenDate.slice(0, 7))) {
      skippedLockedCount++
      continue
    }
    const matchIndex = queueByKey.get(contentKey(inc))?.shift()
    if (matchIndex === undefined) {
      merged.push(inc)
      addedCount++
      continue
    }
    const updated = { ...merged[matchIndex] }
    for (const field of OVERRIDE_FIELDS) {
      if (isEmptyValue(inc[field])) continue
      ;(updated as Record<string, unknown>)[field] = inc[field]
    }
    // 결제일을 엑셀 값으로 확정했으면 통장내역 매칭의 "확인 필요" 표시는 더 이상 의미가 없다.
    if (!isEmptyValue(inc.paymentDate)) {
      delete updated.paymentMatchStatus
      delete updated.paymentMatchNote
    }
    merged[matchIndex] = updated
    updatedCount++
  }

  return { rows: renumber(merged), updatedCount, addedCount, skippedLockedCount }
}
