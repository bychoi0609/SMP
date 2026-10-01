import { formatAmount, formatNumber } from "@/lib/format"
import type { LedgerCell, LedgerSummary } from "@/lib/revenue-ledger"

// 매출 현황 표에서 고를 수 있는 항목.
export const REVENUE_METRICS = {
  total: {
    label: "매출액",
    unit: "원",
    pick: (v: LedgerCell | LedgerSummary) => v.totalAmount,
    format: (n: number | null) => formatAmount(n),
  },
  generation: {
    label: "발전량",
    unit: "kWh",
    pick: (v: LedgerCell | LedgerSummary) => v.generationKwh,
    format: (n: number | null) => formatAmount(n === null ? null : Math.round(n)),
  },
  hours: {
    label: "발전시간",
    unit: "h",
    pick: (v: LedgerCell | LedgerSummary) => v.generationHours,
    format: (n: number | null) => formatNumber(n, 2),
  },
  smp: {
    label: "SMP금액",
    unit: "원",
    pick: (v: LedgerCell | LedgerSummary) => v.smpAmount,
    format: (n: number | null) => formatAmount(n),
  },
  recQuantity: {
    label: "REC수량",
    unit: "REC",
    pick: (v: LedgerCell | LedgerSummary) => v.recQuantity,
    format: (n: number | null) => formatAmount(n),
  },
  rec: {
    label: "REC금액",
    unit: "원",
    pick: (v: LedgerCell | LedgerSummary) => v.recAmount,
    format: (n: number | null) => formatAmount(n),
  },
} as const

export type RevenueMetric = keyof typeof REVENUE_METRICS

export function isRevenueMetric(value: string | undefined): value is RevenueMetric {
  return !!value && value in REVENUE_METRICS
}
