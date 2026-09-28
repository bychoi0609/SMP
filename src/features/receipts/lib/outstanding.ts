import type { TaxInvoiceDirection, TaxInvoiceRow } from '../types/tables'

// "미수·미지급 현황" 화면의 판단 규칙 — 대금기준이 외상 계정이고 결제일이 비어 있으면 아직 돈이
// 오가지 않은 건으로 본다(결제일 = 실제로 입금/지급된 날).
export const RECEIVABLE_ACCOUNTS = ['외상매출금'] as const
export const PAYABLE_ACCOUNTS = ['외상매입금', '미지급금'] as const

export function isOutstanding(row: Pick<TaxInvoiceRow, 'paymentBasisAccount' | 'paymentDate'>, direction: TaxInvoiceDirection) {
  if (row.paymentDate.trim() !== '') return false
  const accounts: readonly string[] = direction === 'sales' ? RECEIVABLE_ACCOUNTS : PAYABLE_ACCOUNTS
  return accounts.includes(row.paymentBasisAccount.trim())
}

export type AgingBucket = '30일 이내' | '31~60일' | '61~90일' | '90일 초과'

// 작성일자로부터 기준일(보통 오늘)까지 지난 일수. 작성일자가 비었거나 형식이 다르면 0으로 본다.
export function daysSince(writtenDate: string, today: Date): number {
  const m = writtenDate.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return 0
  const written = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  const base = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.max(0, Math.floor((base - written) / 86_400_000))
}

export function agingBucketOf(days: number): AgingBucket {
  if (days <= 30) return '30일 이내'
  if (days <= 60) return '31~60일'
  if (days <= 90) return '61~90일'
  return '90일 초과'
}

export interface CounterpartyOutstanding {
  key: string // 사업자번호(숫자만) — 없으면 거래처명
  counterpartyName: string
  counterpartyBizNo: string
  count: number
  totalAmount: number
  oldestWrittenDate: string
  maxDays: number
}

export function counterpartyKeyOf(row: Pick<TaxInvoiceRow, 'counterpartyBizNo' | 'counterpartyName'>): string {
  const digits = row.counterpartyBizNo.replace(/\D/g, '')
  return digits !== '' ? digits : `N:${row.counterpartyName.trim()}`
}

// 거래처별로 묶어 합계금액이 큰 순으로 정렬한다.
export function groupOutstandingByCounterparty(
  rows: Pick<TaxInvoiceRow, 'counterpartyBizNo' | 'counterpartyName' | 'totalAmount' | 'writtenDate'>[],
  today: Date,
): CounterpartyOutstanding[] {
  const byKey = new Map<string, CounterpartyOutstanding>()
  for (const row of rows) {
    const key = counterpartyKeyOf(row)
    const days = daysSince(row.writtenDate, today)
    const current = byKey.get(key)
    if (!current) {
      byKey.set(key, {
        key,
        counterpartyName: row.counterpartyName,
        counterpartyBizNo: row.counterpartyBizNo,
        count: 1,
        totalAmount: row.totalAmount,
        oldestWrittenDate: row.writtenDate,
        maxDays: days,
      })
      continue
    }
    current.count++
    current.totalAmount += row.totalAmount
    if (row.writtenDate && (!current.oldestWrittenDate || row.writtenDate < current.oldestWrittenDate))
      current.oldestWrittenDate = row.writtenDate
    current.maxDays = Math.max(current.maxDays, days)
  }
  return [...byKey.values()].sort((a, b) => b.totalAmount - a.totalAmount)
}
