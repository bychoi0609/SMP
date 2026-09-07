import { cellText, parseAmount, parseDateOnly } from './format'
import type { TaxInvoiceDirection, TaxInvoiceRow } from '../types/tables'

// 홈택스 매출/매입 전자세금계산서 목록 원본 컬럼 인덱스 (0-based).
// "상호"/"종사업장번호"/"대표자명"/"주소"는 공급자·공급받는자 양쪽에 동일한 헤더명으로
// 두 번 등장하므로 이름이 아닌 실제 열 위치로 참조한다.
const COL = {
  writtenDate: 0,
  approvalNo: 1,
  supplierBizNo: 4,
  supplierName: 6,
  buyerBizNo: 9,
  buyerName: 11,
  totalAmount: 14,
  supplyAmount: 15,
  taxAmount: 16,
  itemName: 26,
} as const

export function detectDirectionFromFileName(fileName: string): TaxInvoiceDirection | null {
  if (fileName.includes('매출')) return 'sales'
  if (fileName.includes('매입')) return 'purchase'
  return null
}

function isBlankRow(row: string[] | undefined): boolean {
  return !row || row.every((cell) => cellText(cell) === '')
}

// PRD 7.1.3 입력 → 출력 매핑 규칙 구현.
export function parseTaxInvoiceRows(
  rows: string[][],
  headerRowIndex: number,
  direction: TaxInvoiceDirection,
  startNo: number,
): TaxInvoiceRow[] {
  const dataRows = rows.slice(headerRowIndex + 1).filter((r) => !isBlankRow(r))
  const isSales = direction === 'sales'

  return dataRows.map((r, idx) => ({
    no: startNo + idx,
    writtenDate: parseDateOnly(r[COL.writtenDate]),
    approvalNo: cellText(r[COL.approvalNo]),
    counterpartyBizNo: cellText(isSales ? r[COL.buyerBizNo] : r[COL.supplierBizNo]),
    counterpartyName: cellText(isSales ? r[COL.buyerName] : r[COL.supplierName]),
    totalAmount: parseAmount(r[COL.totalAmount]),
    supplyAmount: parseAmount(r[COL.supplyAmount]),
    taxAmount: parseAmount(r[COL.taxAmount]),
    itemName: cellText(r[COL.itemName]),
    issueType: '전자',
    taxType: '과세',
    accountCode: '',
    siteCode: null,
    paymentBasisAccount: '',
    paymentDate: '',
    note: '',
    project: '',
    detail: '',
  }))
}
