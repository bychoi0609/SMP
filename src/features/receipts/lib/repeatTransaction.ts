import type { AccountRuleEntry } from '../data/accountRules'
import { applyRuleSideEffects, findAccountRuleMatch } from './accountRules'
import type { TaxInvoiceDirection, TaxInvoiceRow } from '../types/tables'
import { applyTaxInvoiceHardRules } from './taxInvoiceHardRules'

// "관리운영비(7월)" ↔ "관리운영비(8월)", "전력거래대금 외(2026년05월1차)" ↔ "...2차"처럼
// 월/차수/생산시기 등 숫자 부분만 다른 경우를 같은 거래로 보기 위해 숫자를 모두 제거하고 비교한다.
// 사업자등록번호가 이미 거래처를 특정하므로, 품목명 쪽은 숫자를 넓게 무시해도 안전하다.
export function normalizeItemName(itemName: string): string {
  return itemName.replace(/\d+/g, '').trim()
}

// 사업자등록번호가 같고 품목명이 완전히 같거나 숫자 부분만 다르면 같은 반복 거래로 본다.
export function isSameCounterpartyAndItem(a: TaxInvoiceRow, b: TaxInvoiceRow): boolean {
  if (a.counterpartyBizNo === '' || a.counterpartyBizNo !== b.counterpartyBizNo) return false
  if (a.itemName === b.itemName) return true
  return normalizeItemName(a.itemName) === normalizeItemName(b.itemName)
}

function isRepeatOf(candidate: TaxInvoiceRow, target: TaxInvoiceRow): boolean {
  if (!candidate.accountCode) return false
  return isSameCounterpartyAndItem(candidate, target)
}

// 사업자등록번호 + 품목명(완전 일치 또는 숫자 부분만 상이)이 일치하는 과거 데이터 중
// 가장 최근 것의 계정과목을 찾는다 (FR-2).
export function findAccountCodeMatch(
  history: TaxInvoiceRow[],
  target: TaxInvoiceRow,
  excludeIndex?: number,
): string | null {
  for (let i = history.length - 1; i >= 0; i--) {
    if (i === excludeIndex) continue
    if (isRepeatOf(history[i], target)) return history[i].accountCode
  }
  return null
}

// 업로드로 새로 들어온 여러 행에 대해, 계정과목 규칙 목록을 먼저 확인하고 없으면
// 누적 이력(및 같은 업로드 배치 내 앞선 행)을 참고해 계정과목이 비어있는 행을 자동으로 채운다.
export function applyAccountCodeAutofillBatch(
  newRows: TaxInvoiceRow[],
  historyRows: TaxInvoiceRow[],
  direction: TaxInvoiceDirection,
  rules: AccountRuleEntry[] = [],
): TaxInvoiceRow[] {
  const pool = [...historyRows]
  const result: TaxInvoiceRow[] = []

  for (const row of newRows) {
    let next = row
    if (!next.accountCode) {
      const ruleMatch = findAccountRuleMatch(rules, next, direction)
      if (ruleMatch) {
        next = applyRuleSideEffects(next, ruleMatch)
      } else {
        const match = findAccountCodeMatch(pool, next)
        if (match) next = { ...next, accountCode: match }
      }
    }
    next = applyTaxInvoiceHardRules(next, direction)
    pool.push(next)
    result.push(next)
  }

  return result
}
