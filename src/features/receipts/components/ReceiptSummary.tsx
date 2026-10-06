'use client'

import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { formatNumber } from '../lib/format'
import type { ReceiptGroupSummary, ReceiptTotals } from '../lib/summarizeReceipts'

const COLLAPSED_LIMIT = 5

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'warning' }) {
  return (
    <div className="flex flex-col gap-0.5 px-4 first:pl-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={`flex items-center gap-1 text-base font-semibold tabular-nums ${tone === 'warning' ? 'text-warning-foreground' : ''}`}
      >
        {tone === 'warning' && <AlertTriangle className="h-4 w-4" />}
        {value}
      </span>
    </div>
  )
}

interface GroupCardProps {
  title: string
  groups: ReceiptGroupSummary[]
  grandTotal: number
  activeKey: string | null
  onSelect: (key: string) => void
}

function GroupCard({ title, groups, grandTotal, activeKey, onSelect }: GroupCardProps) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? groups : groups.slice(0, COLLAPSED_LIMIT)

  return (
    <div className="flex flex-col rounded-lg border bg-card p-3 text-sm">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="font-semibold">{title}</h2>
        <span className="text-xs text-muted-foreground">{groups.length}개 항목</span>
      </div>
      <ul className="flex flex-col gap-1">
        {visible.map((g) => {
          const ratio = grandTotal > 0 ? Math.min(Math.max(g.total / grandTotal, 0), 1) : 0
          const active = activeKey === g.key
          // 미지정(빈 값)은 검색어로 걸러낼 수 없어 클릭 대상에서 제외한다.
          const clickable = g.key !== ''
          return (
            <li key={g.key}>
              <button
                type="button"
                disabled={!clickable}
                onClick={() => onSelect(g.key)}
                title={clickable ? (active ? '다시 누르면 필터를 해제합니다' : '이 항목만 조회합니다') : undefined}
                className={`w-full rounded-md px-2 py-1 text-left transition-colors ${
                  active ? 'bg-accent' : clickable ? 'hover:bg-muted' : 'cursor-default'
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className={`truncate ${g.key ? '' : 'text-muted-foreground'}`}>{g.label}</span>
                  <span className="shrink-0 tabular-nums">
                    {formatNumber(g.total)}
                    <span className="ml-1 text-xs text-muted-foreground">({g.count}건)</span>
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${ratio * 100}%` }} />
                  </div>
                  <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">
                    {Math.round(ratio * 100)}%
                  </span>
                </div>
              </button>
            </li>
          )
        })}
      </ul>
      {groups.length > COLLAPSED_LIMIT && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 self-center text-xs text-muted-foreground hover:text-foreground"
        >
          {expanded ? '접기 ▴' : `더보기 (${groups.length - COLLAPSED_LIMIT}개) ▾`}
        </button>
      )}
    </div>
  )
}

export interface ReceiptSummaryDimension {
  title: string
  groups: ReceiptGroupSummary[]
  activeKey: string | null
  onSelect: (key: string) => void
}

interface ReceiptSummaryProps {
  totals: ReceiptTotals
  dimensions: ReceiptSummaryDimension[]
}

// 월별 영수증 데이터 조회 결과 요약 — 합계 숫자 한 줄 + 항목별(카드/계정과목/세부내역) 합계금액 카드.
export function ReceiptSummary({ totals, dimensions }: ReceiptSummaryProps) {
  return (
    <div className="mt-3 flex flex-col gap-3">
      <div className="flex flex-wrap divide-x rounded-lg border bg-card p-3">
        <Stat label="총 사용액" value={`${formatNumber(totals.total)}원`} />
        <Stat label="건수" value={`${formatNumber(totals.count)}건`} />
        <Stat label="공급가액" value={formatNumber(totals.supply)} />
        <Stat label="부가세" value={formatNumber(totals.tax)} />
        {totals.unclassified > 0 && (
          <Stat label="미분류(계정과목·세부내역 빈 행)" value={`${totals.unclassified}건`} tone="warning" />
        )}
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {dimensions.map((d) => (
          <GroupCard key={d.title} grandTotal={totals.total} {...d} />
        ))}
      </div>
    </div>
  )
}
