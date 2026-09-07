import type { TaxInvoiceDirection, TaxInvoiceRow } from '../types/tables'

const PAYMENT_BASIS_BY_DIRECTION: Record<TaxInvoiceDirection, { after: string; before: string; same: string }> = {
  sales: { after: '외상매출금', before: '선수금', same: '보통예금' },
  purchase: { after: '미지급금', before: '선급금', same: '보통예금' },
}

// 결제일이 작성일자보다 나중/이전/같음을 비교해 대금기준을 계산한다.
// 두 값 모두 "YYYY-MM-DD" 문자열이므로 사전식 비교로 충분하다.
function derivePaymentBasisAccount(direction: TaxInvoiceDirection, writtenDate: string, paymentDate: string): string {
  const basis = PAYMENT_BASIS_BY_DIRECTION[direction]
  if (paymentDate > writtenDate) return basis.after
  if (paymentDate < writtenDate) return basis.before
  return basis.same
}

// 계정과목 규칙 목록(AccountRulePanel)과 별개로 항상 성립해야 하는 PRD 고정 업무 규칙.
// 행이 만들어지거나 바뀌는 모든 경로(직접 수정/업로드 자동입력/통장매칭)에서 호출해 일관성을 보장한다.
export function applyTaxInvoiceHardRules(row: TaxInvoiceRow, direction: TaxInvoiceDirection): TaxInvoiceRow {
  let next = row

  // 매입 + 프로젝트=솔라룸 → 세부내역은 무조건 "상품"
  if (direction === 'purchase' && next.project === '솔라룸' && next.detail !== '상품') {
    next = { ...next, detail: '상품' }
  }

  // 매출 + 계정과목=상품매출 → 프로젝트는 무조건 "솔라룸"
  if (direction === 'sales' && next.accountCode === '상품매출' && next.project !== '솔라룸') {
    next = { ...next, project: '솔라룸' }
  }

  // 대금기준은 비어있을 때만 결제일/작성일자 비교로 채운다(수기 입력·규칙으로 채운 값은 덮어쓰지 않음).
  if (!next.paymentBasisAccount && next.writtenDate && next.paymentDate) {
    next = { ...next, paymentBasisAccount: derivePaymentBasisAccount(direction, next.writtenDate, next.paymentDate) }
  }

  return next
}
