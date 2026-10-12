import { SITE_CODE_DETAIL_MAP, type TaxInvoiceRow } from '../types/tables'

// "구분번호" 입력 시 "세부내역"을 자동으로 채운다 (6→공사, 7→제조, 8→사무실 기본값).
// 매핑에 없는 값이면 기존 세부내역을 그대로 둔다 — 사용자가 직접 수정한 값을 지우지 않기 위함.
export function deriveDetailForSiteCode(siteCode: number | null, currentDetail: string): string {
  if (siteCode === null) return currentDetail
  return SITE_CODE_DETAIL_MAP[siteCode] ?? currentDetail
}

// 매입 세금계산서의 구분번호 → 세부내역(+프로젝트) 자동 입력.
// 8번은 본사 비용이라 프로젝트 "SC본사"·세부내역 "사무실"로 채우되, 계정과목이 "상품"이면
// 솔라룸 상품 매입이므로 프로젝트 "솔라룸"·세부내역 "상품"으로 채운다. 그 외 번호는 기본 매핑을 따른다.
export function applyPurchaseSiteCodeFields(row: TaxInvoiceRow): TaxInvoiceRow {
  if (row.siteCode !== 8) return { ...row, detail: deriveDetailForSiteCode(row.siteCode, row.detail) }
  return row.accountCode === '상품'
    ? { ...row, project: '솔라룸', detail: '상품' }
    : { ...row, project: 'SC본사', detail: '사무실' }
}
