import type { TaxInvoiceRow } from '../types/tables'
import { renumber } from './applyRowUpdate'

// 새로 업로드해서 원본에서 값이 오는 필드만 갱신 대상으로 삼는다. 계정과목/구분번호/대금기준/
// 결제일/프로젝트/세부내역/매칭메타 등 소스 컬럼이 없는 필드는 사용자가 직접 입력했거나 다른
// 자동입력(FR-2 반복거래 인식, FR-4 통장내역 매칭)으로 채워진 값이므로 재업로드로 지워지면 안 된다.
const SOURCE_DERIVED_FIELDS = [
  'writtenDate',
  'counterpartyBizNo',
  'counterpartyName',
  'totalAmount',
  'supplyAmount',
  'taxAmount',
  'itemName',
  'issueType',
  'note',
  'approvalNo',
] as const satisfies readonly (keyof TaxInvoiceRow)[]

// 승인번호(국세청 발급, 문서당 고유값)를 우선 키로 쓴다. 마이그레이션 전에 저장된 레거시 데이터는
// approvalNo가 없으므로, 그 경우에만 작성일자+거래처사업자번호+합계금액+품목명 조합으로 대체한다.
// (레거시 행도 한 번 병합을 거치면 approvalNo가 채워져 다음부터는 정상 키로 매칭된다.)
function keyOf(row: TaxInvoiceRow): string {
  if (row.approvalNo) return `A:${row.approvalNo}`
  return `C:${row.writtenDate}|${row.counterpartyBizNo}|${row.totalAmount}|${row.itemName}`
}

export function mergeTaxInvoiceRows(existing: TaxInvoiceRow[], incoming: TaxInvoiceRow[]): TaxInvoiceRow[] {
  const merged = [...existing]
  const indexByKey = new Map(merged.map((r, i) => [keyOf(r), i]))

  for (const inc of incoming) {
    const key = keyOf(inc)
    const matchIndex = indexByKey.get(key)
    if (matchIndex === undefined) {
      merged.push(inc)
      indexByKey.set(key, merged.length - 1)
      continue
    }
    const updated = { ...merged[matchIndex] }
    for (const field of SOURCE_DERIVED_FIELDS) {
      ;(updated as Record<string, unknown>)[field] = inc[field]
    }
    merged[matchIndex] = updated
  }

  return renumber(merged)
}
