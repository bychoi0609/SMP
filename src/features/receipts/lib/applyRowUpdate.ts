import type { AccountRuleEntry } from '../data/accountRules'
import { applyRuleSideEffects, findAccountRuleMatch, findAccountRuleMatchForReceipt } from './accountRules'
import type { ReceiptRow, TaxInvoiceDirection, TaxInvoiceRow } from '../types/tables'
import { findAccountCodeMatch, isSameCounterpartyAndItem } from './repeatTransaction'
import { deriveDetailForSiteCode } from './siteCode'
import { applyTaxInvoiceHardRules } from './taxInvoiceHardRules'

// 세금계산서 한 행을 수정하면서, 계정과목 규칙 목록/반복 거래 인식(계정과목 자동 입력)과
// 구분번호→세부내역 자동 입력 부수효과를 함께 적용한다 (FR-2).
export function applyTaxInvoiceRowUpdate(
  rows: TaxInvoiceRow[],
  index: number,
  patch: Partial<TaxInvoiceRow>,
  direction: TaxInvoiceDirection,
  rules: AccountRuleEntry[] = [],
): TaxInvoiceRow[] {
  let updated: TaxInvoiceRow = { ...rows[index], ...patch }

  if (('counterpartyBizNo' in patch || 'itemName' in patch) && !updated.accountCode) {
    const ruleMatch = findAccountRuleMatch(rules, updated, direction)
    if (ruleMatch) {
      updated = applyRuleSideEffects(updated, ruleMatch)
    } else {
      const match = findAccountCodeMatch(rows, updated, index)
      if (match) updated = { ...updated, accountCode: match }
    }
  }

  if ('siteCode' in patch) {
    updated = { ...updated, detail: deriveDetailForSiteCode(updated.siteCode, updated.detail) }
  }

  updated = applyTaxInvoiceHardRules(updated, direction)

  const result = rows.map((r, i) => (i === index ? updated : r))

  // 계정과목을 직접 입력/수정한 경우, 같은 업로드에 포함된 다른 반복 거래 행(같은 사업자등록번호
  // + 품목명이 완전히 같거나 숫자만 다름) 중 아직 계정과목이 비어있는 행도 함께 채운다.
  if ('accountCode' in patch && updated.accountCode) {
    return result.map((r, i) =>
      i !== index && !r.accountCode && isSameCounterpartyAndItem(r, updated)
        ? applyTaxInvoiceHardRules({ ...r, accountCode: updated.accountCode }, direction)
        : r,
    )
  }

  return result
}

export function applyReceiptRowUpdate(
  row: ReceiptRow,
  patch: Partial<ReceiptRow>,
  rules: AccountRuleEntry[] = [],
): ReceiptRow {
  let updated: ReceiptRow = { ...row, ...patch }

  if ('merchantName' in patch && !updated.accountCode) {
    const ruleMatch = findAccountRuleMatchForReceipt(rules, updated)
    if (ruleMatch) {
      updated = { ...updated, accountCode: ruleMatch.accountName }
      if (ruleMatch.siteCode !== null && updated.siteCode === null) {
        updated = { ...updated, siteCode: ruleMatch.siteCode, detail: deriveDetailForSiteCode(ruleMatch.siteCode, updated.detail) }
      }
    }
  }

  if ('siteCode' in patch) {
    updated = { ...updated, detail: deriveDetailForSiteCode(updated.siteCode, updated.detail) }
  }
  return updated
}

export function renumber(rows: TaxInvoiceRow[]): TaxInvoiceRow[] {
  return rows.map((r, i) => ({ ...r, no: i + 1 }))
}
