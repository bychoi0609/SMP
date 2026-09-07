import type { TaxInvoiceDirection, TaxInvoiceRow } from '../types/tables'
import type { BankTransaction } from '../types/bankTransaction'
import { applyTaxInvoiceHardRules } from './taxInvoiceHardRules'

function bankAmountFor(direction: TaxInvoiceDirection, tx: BankTransaction): number {
  return direction === 'sales' ? tx.deposit : tx.withdrawal
}

// 은행 거래내용/예금주명과 세금계산서 상호를 비교하기 전에 표기 차이를 흡수한다.
// - 공백(일반/전각) 유무 차이: "주식회사 쏠라크리닉" vs "주식회사쏠라크리닉"
// - 법인 형태 표기 차이: "(주)ABC" vs "주식회사ABC"
const CORP_ENTITY_TOKENS = ['주식회사', '유한책임회사', '유한회사', '합자회사', '합명회사', '사단법인', '재단법인', '㈜', '(주)']

function normalizeCounterpartyName(name: string): string {
  let normalized = name.replace(/[\s　]/g, '')
  for (const token of CORP_ENTITY_TOKENS) {
    normalized = normalized.split(token).join('')
  }
  return normalized.trim()
}

// 짧은-쪽-포함 비교(은행측 표기 잘림 대응)에서 오매칭을 막기 위한 최소 길이.
const MIN_TRUNCATED_MATCH_LENGTH = 2

function isNameMatch(name: string, field: string): boolean {
  if (!field) return false
  if (field.includes(name)) return true
  return field.length >= MIN_TRUNCATED_MATCH_LENGTH && name.includes(field)
}

function counterpartyNameFoundIn(row: TaxInvoiceRow, tx: BankTransaction): boolean {
  if (!row.counterpartyName) return false
  const name = normalizeCounterpartyName(row.counterpartyName)
  if (!name) return false
  const description = normalizeCounterpartyName(tx.description)
  const accountHolder = normalizeCounterpartyName(tx.counterpartyAccountHolder)
  return isNameMatch(name, description) || isNameMatch(name, accountHolder)
}

// PRD FR-4: 매출은 입금, 매입은 출금 방향으로만 매칭하고(오매칭 방지),
// 합계금액이 정확히 일치 + 상호가 거래내용/상대계좌예금주명에 포함되는 경우에만 결제일을 확정한다.
// 매칭 대상도 세금계산서의 귀속월(작성일자 기준 YYYY-MM)과 같은 달의 통장내역으로 한정한다 —
// 예) 7월 세금계산서는 7월(1~31일) 통장내역에서만 찾는다. 다른 달에 우연히 금액이 같은
// 무관한 거래와 매칭되는 것을 막는다. 이미 결제일이 채워진 행(수기 입력 포함)은 건드리지 않는다.
export function matchTaxInvoicesWithBank(
  rows: TaxInvoiceRow[],
  direction: TaxInvoiceDirection,
  bankTransactions: BankTransaction[],
): TaxInvoiceRow[] {
  return rows.map((row) => {
    if (row.paymentDate) return row

    const amountMatches = bankTransactions.filter((tx) => {
      const amount = bankAmountFor(direction, tx)
      if (amount <= 0 || amount !== row.totalAmount) return false
      if (row.writtenDate) {
        // 결제일이 세금계산서 작성일보다 앞설 수는 없다 — 우연히 금액만 같은 무관한 거래를 배제.
        if (tx.dateOnly < row.writtenDate) return false
        // 같은 귀속월(YYYY-MM)의 통장내역만 대상으로 삼는다.
        if (tx.dateOnly.slice(0, 7) !== row.writtenDate.slice(0, 7)) return false
      }
      return true
    })

    if (amountMatches.length === 0) {
      // 매칭되지 않은 건은 공란으로 유지 — 기존 애매 표시가 있었다면 지운다.
      if (row.paymentMatchStatus) {
        const { paymentMatchStatus: _s, paymentMatchNote: _n, ...rest } = row
        return rest as TaxInvoiceRow
      }
      return row
    }

    const nameMatches = amountMatches.filter((tx) => counterpartyNameFoundIn(row, tx))

    if (nameMatches.length === 1) {
      const { paymentMatchStatus: _s, paymentMatchNote: _n, ...rest } = row
      return applyTaxInvoiceHardRules({ ...rest, paymentDate: nameMatches[0].dateOnly } as TaxInvoiceRow, direction)
    }

    if (nameMatches.length === 0) {
      return {
        ...row,
        paymentMatchStatus: 'ambiguous',
        paymentMatchNote: `금액(${row.totalAmount.toLocaleString('ko-KR')}원)은 일치하는 통장내역이 있지만 거래처명("${row.counterpartyName}")이 포함된 내역이 없습니다. 직접 확인 후 입력해주세요.`,
      }
    }

    return {
      ...row,
      paymentMatchStatus: 'ambiguous',
      paymentMatchNote: `금액과 거래처명이 모두 일치하는 통장내역 후보가 ${nameMatches.length}건입니다 (${nameMatches
        .map((tx) => tx.dateOnly)
        .join(', ')}). 직접 확인 후 선택해주세요.`,
    }
  })
}

export interface MatchSummary {
  matched: number
  ambiguous: number
}

export function summarizeMatchDiff(before: TaxInvoiceRow[], after: TaxInvoiceRow[]): MatchSummary {
  let matched = 0
  let ambiguous = 0
  after.forEach((row, i) => {
    const prev = before[i]
    if (!prev.paymentDate && row.paymentDate) matched++
    if (row.paymentMatchStatus === 'ambiguous' && prev.paymentMatchStatus !== 'ambiguous') ambiguous++
  })
  return { matched, ambiguous }
}
