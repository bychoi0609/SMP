import type { ReactNode } from 'react'
import type { ReceiptRow, TaxInvoiceRow } from '../types/tables'
import { formatNumber } from './format'

// 세금계산서(매출/매입) 표 하단 합계 행: 합계금액/공급가액/세액을 합산해 표시한다.
export function taxInvoiceFooterCells(rows: TaxInvoiceRow[]): Record<string, ReactNode> {
  return {
    no: '합계',
    totalAmount: formatNumber(rows.reduce((sum, r) => sum + r.totalAmount, 0)),
    supplyAmount: formatNumber(rows.reduce((sum, r) => sum + r.supplyAmount, 0)),
    taxAmount: formatNumber(rows.reduce((sum, r) => sum + r.taxAmount, 0)),
  }
}

// 영수증 표 하단 합계 행: 공급가액/세액/합계를 합산해 표시한다(카드별/월별로 스코프된 rows 기준).
export function receiptFooterCells(rows: ReceiptRow[]): Record<string, ReactNode> {
  return {
    date: '합계',
    supplyAmount: formatNumber(rows.reduce((sum, r) => sum + r.supplyAmount, 0)),
    taxAmount: formatNumber(rows.reduce((sum, r) => sum + r.taxAmount, 0)),
    totalAmount: formatNumber(rows.reduce((sum, r) => sum + r.totalAmount, 0)),
  }
}
