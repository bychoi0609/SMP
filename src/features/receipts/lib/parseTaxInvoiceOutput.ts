import { cellText, parseAmount, parseDateOnly } from './format'
import type { TaxInvoiceDirection, TaxInvoiceRow } from '../types/tables'

// 이 앱 자체의 세금계산서(매출/매입) 다운로드 양식(exportWorkbook.ts의 SALES_COLUMNS/PURCHASE_COLUMNS와
// 동일한 컬럼 순서, 예: "세금계산서,계산서(2026_08).xlsx")을 그대로 재업로드할 때 쓰는 파서다.
// 홈택스 원본 파일 파서(parseTaxInvoice.ts, 컬럼 구조가 전혀 다름)와는 별개다.
//
// 컬럼 위치(0-based, 매출/매입 공통 접두부):
//   0 번호, 1 작성일자, 2 사업자등록번호(매출=공급받는자/매입=공급자), 3 상호,
//   4 합계금액, 5 공급가액, 6 세액, 7 품목명, 8 유형(전자/종이), 9 유형(과세/불공),
//   10 전표처리(계정과목)
// 매출: 11 전표처리(대금기준), 12 결제일, 13 프로젝트
// 매입: 11 구분(구분번호), 12 전표처리(대금기준), 13 결제일, 14 비고, 15 프로젝트, 16 세부내역

export interface DetectedTaxInvoiceOutputSheet {
  direction: TaxInvoiceDirection
  headerRowIndex: number
}

// "8/7/26"(M/D/YY, 엑셀이 mm-dd-yy 서식을 내부 built-in 포맷으로 저장할 때 흔히 이렇게 표시됨) 등을
// 정규화한다. ISO/점 구분 등 다른 형식은 format.ts의 parseDateOnly에 그대로 위임한다.
function parseFlexibleDate(raw: unknown): string {
  const s = cellText(raw)
  if (s === '') return ''
  const slash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/)
  if (slash) {
    const [, mo, da, yr] = slash
    const year = yr.length === 2 ? `20${yr}` : yr
    return `${year}-${mo.padStart(2, '0')}-${da.padStart(2, '0')}`
  }
  return parseDateOnly(s)
}

// 다운로드 양식 시트는 맨 아래에 합계(SUM) 행이 붙는데, 그 행은 금액 3칸만 채워져 있고
// 작성일자/상호/품목명이 전부 비어 있다 — 이 셋 중 하나라도 있어야 실제 데이터 행으로 본다.
function isDataRow(row: string[] | undefined): boolean {
  if (!row) return false
  return cellText(row[1]) !== '' || cellText(row[3]) !== '' || cellText(row[7]) !== ''
}

// 다운로드 양식 헤더(번호/작성일자/공급받는자(자)사업자등록번호/.../세액)를 스캔해 매출/매입 여부와
// 헤더 행 위치를 찾는다. "세액" 컬럼이 없는 계산서(면세) 시트는 컬럼 구조가 달라 대상에서 제외한다.
export function detectTaxInvoiceOutputSheet(rows: string[][]): DetectedTaxInvoiceOutputSheet | null {
  const scanLimit = Math.min(rows.length, 10)
  for (let i = 0; i < scanLimit; i++) {
    const row = rows[i]
    if (!row || row.length === 0) continue
    if (cellText(row[0]) !== '번호' || cellText(row[1]) !== '작성일자') continue
    if (cellText(row[6]) !== '세액') continue
    const bizNoHeader = cellText(row[2])
    if (bizNoHeader.startsWith('공급받는자')) return { direction: 'sales', headerRowIndex: i }
    if (bizNoHeader.startsWith('공급자')) return { direction: 'purchase', headerRowIndex: i }
  }
  return null
}

export function parseTaxInvoiceOutputRows(
  rows: string[][],
  headerRowIndex: number,
  direction: TaxInvoiceDirection,
  startNo: number,
): TaxInvoiceRow[] {
  const dataRows = rows.slice(headerRowIndex + 1).filter(isDataRow)
  const isSales = direction === 'sales'

  return dataRows.map((r, idx) => {
    const siteCodeText = isSales ? '' : cellText(r[11])
    const siteCodeNum = siteCodeText === '' ? null : Number(siteCodeText.replace(/,/g, ''))

    return {
      no: startNo + idx,
      writtenDate: parseFlexibleDate(r[1]),
      counterpartyBizNo: cellText(r[2]),
      counterpartyName: cellText(r[3]),
      totalAmount: parseAmount(r[4]),
      supplyAmount: parseAmount(r[5]),
      taxAmount: parseAmount(r[6]),
      itemName: cellText(r[7]),
      issueType: cellText(r[8]) === '종이' ? '종이' : '전자',
      taxType: cellText(r[9]) === '불공' ? '불공' : '과세',
      accountCode: cellText(r[10]),
      siteCode: siteCodeNum !== null && Number.isNaN(siteCodeNum) ? null : siteCodeNum,
      paymentBasisAccount: cellText(r[isSales ? 11 : 12]),
      paymentDate: parseFlexibleDate(r[isSales ? 12 : 13]),
      note: isSales ? '' : cellText(r[14]),
      project: cellText(r[isSales ? 13 : 15]),
      detail: isSales ? '' : cellText(r[16]),
    }
  })
}
