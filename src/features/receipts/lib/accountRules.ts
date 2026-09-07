import type { AccountRuleEntry } from '../data/accountRules'
import type { ReceiptRow, TaxInvoiceDirection, TaxInvoiceRow } from '../types/tables'
import { deriveDetailForSiteCode } from './siteCode'

// 규칙의 매칭 조건(구분+사업자등록번호+품목명패턴, 또는 구분+상호)을 식별하는 키.
// 매칭 조건이 비어 있어 사실상 매칭에 쓰일 수 없는 규칙은 null을 반환한다(중복 판정 제외).
export function accountRuleKey(entry: AccountRuleEntry): string | null {
  if (entry.division === '영수증') {
    if (!entry.vendorName) return null
    return `영수증|${entry.vendorName}`
  }
  if (!entry.bizNo) return null
  return `${entry.division}|${entry.bizNo}|${entry.itemPattern}`
}

const DIVISION_BY_DIRECTION: Record<TaxInvoiceDirection, AccountRuleEntry['division']> = {
  sales: '매출',
  purchase: '매입',
}

function matchesTaxInvoiceRule(rule: AccountRuleEntry, row: TaxInvoiceRow, direction: TaxInvoiceDirection): boolean {
  return (
    rule.division === DIVISION_BY_DIRECTION[direction] &&
    rule.bizNo !== '' &&
    rule.bizNo === row.counterpartyBizNo &&
    row.itemName.includes(rule.itemPattern)
  )
}

// 매칭된 규칙 전체를 반환한다 — accountName뿐 아니라 함께 자동 입력할 siteCode(구분번호)도 필요하기 때문.
export function findAccountRuleMatch(
  rules: AccountRuleEntry[],
  row: TaxInvoiceRow,
  direction: TaxInvoiceDirection,
): AccountRuleEntry | null {
  return rules.find((r) => matchesTaxInvoiceRule(r, row, direction)) ?? null
}

// 규칙이 매칭됐을 때 계정과목과 함께 자동 입력할 부수 필드(구분번호→세부내역, 비고, 프로젝트, 대금기준)를 적용한다.
// 각 필드는 규칙에 값이 지정되어 있고 행이 비어있을 때만 채운다(이미 값이 있는 행은 덮어쓰지 않음).
export function applyRuleSideEffects(row: TaxInvoiceRow, match: AccountRuleEntry): TaxInvoiceRow {
  let next: TaxInvoiceRow = { ...row, accountCode: match.accountName }
  if (match.siteCode !== null && next.siteCode === null) {
    next = { ...next, siteCode: match.siteCode, detail: deriveDetailForSiteCode(match.siteCode, next.detail) }
  }
  if (match.note !== '' && next.note === '') next = { ...next, note: match.note }
  if (match.project !== '' && next.project === '') next = { ...next, project: match.project }
  if (match.paymentBasisAccount !== '' && next.paymentBasisAccount === '') {
    next = { ...next, paymentBasisAccount: match.paymentBasisAccount }
  }
  return next
}

// 규칙에 해당하지만 계정과목이 비어있는 행에 소급 적용한다 (이미 값이 있는 행은 건드리지 않음).
export function applyAccountRulesToRows(
  rows: TaxInvoiceRow[],
  rules: AccountRuleEntry[],
  direction: TaxInvoiceDirection,
): TaxInvoiceRow[] {
  if (rules.length === 0) return rows
  return rows.map((r) => {
    if (r.accountCode) return r
    const match = findAccountRuleMatch(rules, r, direction)
    return match ? applyRuleSideEffects(r, match) : r
  })
}

// 영수증은 사업자등록번호·품목명이 없으므로(가맹점명만 있음) 상호(가맹점명) 부분포함으로 매칭한다.
function matchesReceiptRule(rule: AccountRuleEntry, row: ReceiptRow): boolean {
  return rule.division === '영수증' && rule.vendorName !== '' && row.merchantName.includes(rule.vendorName)
}

export function findAccountRuleMatchForReceipt(rules: AccountRuleEntry[], row: ReceiptRow): AccountRuleEntry | null {
  return rules.find((r) => matchesReceiptRule(r, row)) ?? null
}

export function applyAccountRulesToReceiptRows(rows: ReceiptRow[], rules: AccountRuleEntry[]): ReceiptRow[] {
  if (rules.length === 0) return rows
  return rows.map((r) => {
    if (r.accountCode) return r
    const match = findAccountRuleMatchForReceipt(rules, r)
    if (!match) return r
    if (match.siteCode !== null && r.siteCode === null) {
      return { ...r, accountCode: match.accountName, siteCode: match.siteCode, detail: deriveDetailForSiteCode(match.siteCode, r.detail) }
    }
    return { ...r, accountCode: match.accountName }
  })
}
