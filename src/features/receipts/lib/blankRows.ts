import type { ReceiptRow, TaxInvoiceRow } from '../types/tables'

export function createBlankTaxInvoiceRow(no: number): TaxInvoiceRow {
  return {
    no,
    writtenDate: '',
    counterpartyBizNo: '',
    counterpartyName: '',
    totalAmount: 0,
    supplyAmount: 0,
    taxAmount: 0,
    itemName: '',
    issueType: '전자',
    taxType: '과세',
    accountCode: '',
    siteCode: null,
    paymentBasisAccount: '',
    paymentDate: '',
    note: '',
    project: '',
    detail: '',
  }
}

export function createBlankReceiptRow(): ReceiptRow {
  return {
    date: '',
    merchantName: '',
    supplyAmount: 0,
    taxAmount: 0,
    totalAmount: 0,
    siteName: '',
    description: '',
    accountCode: '',
    siteCode: null,
    taxType: '',
    detail: '',
  }
}
