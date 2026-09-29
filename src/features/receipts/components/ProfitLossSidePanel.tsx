'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { formatNumber } from '../lib/format'
import {
  buildProfitLoss,
  monthlyProfitLoss,
  monthsBetween,
  NO_ACCOUNT_LABEL,
  SECTION_LABEL,
  type ProfitLoss,
  type ProfitLossSection,
  type ProfitLossSourceData,
} from '../lib/profitLoss'

// 손익계산서 표 옆 보조 패널 — 월별 매출·영업이익 추이와 매출·비용 구성. 차트 라이브러리 없이 막대만 그린다.
// 연도별 조회는 가장 최근 연도의 1~12월, 기간 조회는 그 기간의 월들을 보여준다.
type PanelScope = { kind: 'year'; year: string } | { kind: 'period'; start: string; end: string }

const COST_SECTIONS: ProfitLossSection[] = [
  'CONSTRUCTION_COST',
  'MANUFACTURING_COST',
  'MERCHANDISE_COST',
  'SGA',
  'UNCLASSIFIED',
  'NON_OPERATING_EXPENSE',
]
const COST_COLORS = ['bg-chart-1', 'bg-chart-2', 'bg-chart-3', 'bg-chart-4', 'bg-warning-foreground', 'bg-chart-5']
// 매출은 비용과 헷갈리지 않게 네이비 한 가지 색의 진하기로 나눈다.
const REVENUE_COLORS = ['bg-primary', 'bg-primary/75', 'bg-primary/55', 'bg-primary/40', 'bg-primary/25', 'bg-primary/15']
const REVENUE_TOP_N = 5
const UNASSIGNED_LABEL = '미지정'
const OTHERS_LABEL = '기타'

interface CompositionItem {
  key: string
  label: string
  amount: number
  color: string
}

// 매출 계정과목을 금액 큰 순으로 상위 REVENUE_TOP_N개만 두고 나머지는 '기타'로 묶는다. 계정과목이 없는 매출은
// '미지정'으로 항상 맨 아래에 둔다. 마이너스 조정만 남은 계정과목도 목록에는 그대로 보여준다.
function revenueComposition(pl: ProfitLoss): CompositionItem[] {
  const lines = pl.sections.REVENUE.lines.filter((l) => l.total !== 0)
  const named = lines.filter((l) => l.accountCode !== NO_ACCOUNT_LABEL).sort((a, b) => b.total - a.total)
  const unassigned = lines.find((l) => l.accountCode === NO_ACCOUNT_LABEL)
  const items: CompositionItem[] = named
    .slice(0, REVENUE_TOP_N)
    .map((l, i) => ({ key: l.accountCode, label: l.accountCode, amount: l.total, color: REVENUE_COLORS[i] }))
  const others = named.slice(REVENUE_TOP_N).reduce((s, l) => s + l.total, 0)
  if (named.length > REVENUE_TOP_N) {
    items.push({ key: OTHERS_LABEL, label: OTHERS_LABEL, amount: others, color: REVENUE_COLORS[REVENUE_TOP_N] })
  }
  if (unassigned) {
    items.push({ key: UNASSIGNED_LABEL, label: UNASSIGNED_LABEL, amount: unassigned.total, color: 'bg-muted-foreground/40' })
  }
  return items
}

const CHART_HEIGHT = 180

export function ProfitLossSidePanel({
  data,
  scope,
  scopeLabel,
}: {
  data: ProfitLossSourceData
  scope: PanelScope
  scopeLabel: string
}) {
  const monthly: ProfitLoss = useMemo(() => {
    if (scope.kind === 'year') return monthlyProfitLoss(data, scope.year)
    const months = monthsBetween(scope.start, scope.end)
    return buildProfitLoss(data, months, (d) => months.indexOf(d.slice(0, 7)))
  }, [data, scope])

  const revenues = revenueComposition(monthly)
  const costs: CompositionItem[] = COST_SECTIONS.map((section, i) => ({
    key: section,
    label: SECTION_LABEL[section],
    color: COST_COLORS[i],
    amount: monthly.sections[section].total,
  })).filter((c) => c.amount !== 0)

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <PanelTitle title="월별 추이" scopeLabel={scopeLabel} />
        <MonthlyBars pl={monthly} />
      </div>

      <CompositionCard
        title="매출 구성"
        scopeLabel={scopeLabel}
        items={revenues}
        totalLabel="매출 합계"
        emptyText="이 기간에 반영된 매출이 없어요."
      />
      <CompositionCard
        title="비용 구성"
        scopeLabel={scopeLabel}
        items={costs}
        totalLabel="비용 합계"
        emptyText="이 기간에 반영된 비용이 없어요."
      />
    </div>
  )
}

// 비율 막대 + 항목별 금액·% 목록. 비율은 플러스 금액끼리만 나누고, 마이너스 금액은 목록에만 빨간색으로 보여준다.
function CompositionCard({
  title,
  scopeLabel,
  items,
  totalLabel,
  emptyText,
}: {
  title: string
  scopeLabel: string
  items: CompositionItem[]
  totalLabel: string
  emptyText: string
}) {
  const positiveTotal = items.reduce((s, it) => s + Math.max(it.amount, 0), 0)
  const total = items.reduce((s, it) => s + it.amount, 0)
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <PanelTitle title={title} scopeLabel={scopeLabel} />
      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <>
          <div className="mb-4 flex h-3 overflow-hidden rounded-full bg-muted">
            {items
              .filter((it) => it.amount > 0)
              .map((it) => (
                <div
                  key={it.key}
                  className={it.color}
                  style={{ width: `${(it.amount / positiveTotal) * 100}%` }}
                  title={`${it.label} ${formatNumber(it.amount)}원`}
                />
              ))}
          </div>
          <ul className="flex flex-col gap-2.5 text-sm">
            {items.map((it) => (
              <li key={it.key} className="flex items-center gap-2">
                <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', it.color)} />
                <span className="min-w-0 flex-1 truncate">{it.label}</span>
                <span className={cn('tabular-nums', it.amount < 0 && 'text-destructive')}>
                  {formatNumber(it.amount)}
                </span>
                <span className="w-14 text-right text-xs text-muted-foreground tabular-nums">
                  {it.amount > 0 ? `${((it.amount / positiveTotal) * 100).toFixed(1)}%` : '-'}
                </span>
              </li>
            ))}
            <li className="mt-1 flex items-center gap-2 border-t pt-2.5 font-semibold">
              <span className="flex-1 pl-[18px]">{totalLabel}</span>
              <span className={cn('tabular-nums', total < 0 && 'text-destructive')}>{formatNumber(total)}</span>
              <span className="w-14" />
            </li>
          </ul>
        </>
      )}
    </div>
  )
}

function PanelTitle({ title, scopeLabel }: { title: string; scopeLabel: string }) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-2">
      <h2 className="text-base font-semibold">{title}</h2>
      <span className="text-xs text-muted-foreground">{scopeLabel}</span>
    </div>
  )
}

// 달마다 매출(연한 파랑)과 영업이익(네이비, 적자는 빨강) 막대 두 개. 적자가 있으면 0 기준선 아래로 내려 그린다.
function MonthlyBars({ pl }: { pl: ProfitLoss }) {
  const revenue = pl.sections.REVENUE.values
  const income = pl.operatingIncome.values
  const all = [...revenue, ...income]
  const maxPos = Math.max(0, ...all)
  const maxNeg = Math.max(0, ...all.map((v) => -v))
  const range = maxPos + maxNeg

  if (range === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">이 기간에 반영된 금액이 없어요.</p>
  }

  const posHeight = (CHART_HEIGHT * maxPos) / range
  const negHeight = CHART_HEIGHT - posHeight
  const multiYear = pl.columns[0].slice(0, 4) !== pl.columns[pl.columns.length - 1].slice(0, 4)
  // 달이 많으면 이름이 겹치지 않도록 몇 달 걸러 하나씩만 적는다.
  const labelStep = Math.ceil(pl.columns.length / 12)
  const barHeight = (v: number) => `${(Math.abs(v) / range) * CHART_HEIGHT}px`
  const monthLabel = (key: string) =>
    multiYear ? `${key.slice(2, 4)}.${Number(key.slice(5, 7))}` : `${Number(key.slice(5, 7))}월`

  return (
    <div>
      <div className="flex gap-1" style={{ height: CHART_HEIGHT }}>
        {pl.columns.map((key, i) => (
          <div
            key={key}
            className="flex flex-1 flex-col"
            title={`${key.replace('-', '.')}\n매출 ${formatNumber(revenue[i])}원\n영업이익 ${formatNumber(income[i])}원`}
          >
            <div className="flex items-end justify-center gap-0.5" style={{ height: posHeight }}>
              {[revenue[i], income[i]].map((v, j) => (
                <div
                  key={j}
                  className={cn('w-full max-w-3 rounded-t-sm', j === 0 ? 'bg-chart-1/60' : 'bg-primary')}
                  style={{ height: v > 0 ? barHeight(v) : 0 }}
                />
              ))}
            </div>
            <div className="flex items-start justify-center gap-0.5 border-t" style={{ height: negHeight }}>
              {[revenue[i], income[i]].map((v, j) => (
                <div
                  key={j}
                  className={cn('w-full max-w-3 rounded-b-sm', j === 0 ? 'bg-chart-1/60' : 'bg-destructive')}
                  style={{ height: v < 0 ? barHeight(v) : 0 }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1 text-[11px] text-muted-foreground">
        {pl.columns.map((key, i) => (
          <div key={key} className="flex-1 text-center tabular-nums">
            {i % labelStep === 0 && monthLabel(key)}
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-end gap-4 text-xs text-muted-foreground">
        <LegendDot className="bg-chart-1/60" label="매출액" />
        <LegendDot className="bg-primary" label="영업이익" />
        <LegendDot className="bg-destructive" label="영업손실" />
      </div>
    </div>
  )
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn('h-2.5 w-2.5 rounded-sm', className)} />
      {label}
    </span>
  )
}
