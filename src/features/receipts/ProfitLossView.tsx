'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import './receipts.css'
import { Modal } from './components/Modal'
import { ProfitLossManualPanel } from './components/ProfitLossManualPanel'
import { Button } from './components/ui/button'
import { downloadProfitLossWorkbook } from './lib/exportWorkbook'
import { formatNumber } from './lib/format'
import {
  availableYears,
  flattenProfitLoss,
  monthlyProfitLoss,
  ratioOf,
  rowSourceItems,
  SECTION_LABEL,
  SOURCE_KIND_LABEL,
  yearlyProfitLoss,
  type DisplayRow,
  type ManualEntryDTO,
  type ProfitLossSourceData,
  type Series,
} from './lib/profitLoss'
import type { ReceiptCardRowDTO, TaxInvoiceRowDTO } from '@/app/receipts/actions'

type ViewMode = 'yearly' | 'monthly'

const MONTH_NUMBERS = Array.from({ length: 12 }, (_, i) => i + 1)
// 연도별 표는 열이 적어 전체 너비로 늘리면 항목과 금액 사이가 너무 벌어진다 — 열 개수만큼의 고정 폭(px)을 쓴다.
const YEARLY_LABEL_WIDTH = 240
const YEARLY_COLUMN_WIDTH = 160

interface ProfitLossViewProps {
  sales: TaxInvoiceRowDTO[]
  purchases: TaxInvoiceRowDTO[]
  receipts: ReceiptCardRowDTO[]
  manual: ManualEntryDTO[]
  confirmedMonths: { sales: string[]; purchase: string[]; receipt: string[] }
  currentMonth: string // 'YYYY-MM' (한국시간)
}

// 셀 클릭 시 상세 모달 대상 — 그 행의 해당 연도 월별 금액과 원천 자료를 보여준다. month가 null이면 연간 전체.
interface DetailTarget {
  rowKey: string
  year: string
  month: number | null // 0~11
}

type ConfirmStatus = 'confirmed' | 'partial' | 'none'

const CONFIRM_CATEGORY_LABELS = ['매출', '매입', '영수증'] as const

// 확정된 매출/매입 세금계산서·카드 영수증을 모아 손익계산서를 보여주는 조회 화면. 기본은 연도별이고
// 월별로 전환할 수 있다. 서버 액션이 revalidate하면 props가 새로 내려오므로 집계는 props에서 매번 다시 계산한다.
export default function ProfitLossView({
  sales,
  purchases,
  receipts,
  manual,
  confirmedMonths,
  currentMonth,
}: ProfitLossViewProps) {
  const currentYear = currentMonth.slice(0, 4)
  const data: ProfitLossSourceData = useMemo(
    () => ({ sales, purchases, receipts, manual }),
    [sales, purchases, receipts, manual],
  )
  const yearsDesc = useMemo(() => availableYears(data, currentYear), [data, currentYear])
  const yearsAsc = useMemo(() => [...yearsDesc].reverse(), [yearsDesc])

  const [mode, setMode] = useState<ViewMode>('yearly')
  const [year, setYear] = useState(currentYear)
  const [showRatio, setShowRatio] = useState(false)
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  const [detail, setDetail] = useState<DetailTarget | null>(null)
  const [manualOpen, setManualOpen] = useState(false)

  const isMonthly = mode === 'monthly'
  const pl = useMemo(
    () => (isMonthly ? monthlyProfitLoss(data, year) : yearlyProfitLoss(data, yearsAsc)),
    [isMonthly, data, year, yearsAsc],
  )
  const rows = useMemo(() => flattenProfitLoss(pl), [pl])
  const visibleRows = rows.filter((r) => !r.parentKeys.some((k) => collapsed.has(k)))
  const revenue = pl.sections.REVENUE
  const unclassified = pl.sections.UNCLASSIFIED
  const unclassifiedCount = unclassified.lines.reduce((s, l) => s + l.items.length, 0)

  // 요약 카드: 월별은 선택 연도 합계, 연도별은 가장 최근 연도 값.
  const cardYear = isMonthly ? year : yearsAsc[yearsAsc.length - 1]
  const cardValue = (series: Series) => (isMonthly ? series.total : series.values[series.values.length - 1])

  const confirmedSets = useMemo(
    () => [new Set(confirmedMonths.sales), new Set(confirmedMonths.purchase), new Set(confirmedMonths.receipt)],
    [confirmedMonths],
  )

  const columnHeaders = useMemo(() => {
    const monthStatus = (key: string) => {
      const missing = CONFIRM_CATEGORY_LABELS.filter((_, i) => !confirmedSets[i].has(key))
      const status: ConfirmStatus = missing.length === 0 ? 'confirmed' : missing.length === 3 ? 'none' : 'partial'
      return { status, tooltip: missing.length === 0 ? '매출·매입·영수증 모두 확정' : `${missing.join('·')} 미확정` }
    }
    if (isMonthly) {
      return pl.columns.map((key) => ({ label: `${Number(key.slice(5, 7))}월`, ...monthStatus(key) }))
    }
    // 연도별: 지나간 달(이번 달까지)만 보고, 전부 확정이면 확정, 하나도 없으면 미확정, 그 외 일부 미확정.
    return pl.columns.map((y) => {
      const months = MONTH_NUMBERS.map((m) => `${y}-${String(m).padStart(2, '0')}`).filter((k) => k <= currentMonth)
      const statuses = months.map(monthStatus)
      const confirmedMonthsLabel = months
        .filter((_, i) => statuses[i].status === 'confirmed')
        .map((k) => `${Number(k.slice(5, 7))}월`)
      const status: ConfirmStatus =
        statuses.length > 0 && statuses.every((s) => s.status === 'confirmed')
          ? 'confirmed'
          : statuses.every((s) => s.status === 'none')
            ? 'none'
            : 'partial'
      const tooltip = confirmedMonthsLabel.length > 0 ? `확정 완료: ${confirmedMonthsLabel.join(', ')}` : '확정된 달 없음'
      return { label: `${y}년`, status, tooltip }
    })
  }, [isMonthly, pl.columns, confirmedSets, currentMonth])

  const accountSuggestions = useMemo(
    () => [...new Set(rows.filter((r) => r.kind === 'line').map((r) => r.label))],
    [rows],
  )

  // 수기 항목 창은 데이터가 있는 가장 최근 달로 연다(없으면 이번 달).
  const defaultManualMonth = useMemo(() => {
    const keys = [
      ...sales.map((r) => r.writtenDate),
      ...purchases.map((r) => r.writtenDate),
      ...receipts.map((r) => r.row.date),
      ...manual.map((e) => e.billingYearMonth),
    ]
      .map((d) => d.slice(0, 7))
      .filter((k) => /^\d{4}-\d{2}$/.test(k))
    return keys.length > 0 ? keys.reduce((a, b) => (a > b ? a : b)) : currentMonth
  }, [sales, purchases, receipts, manual, currentMonth])

  function toggleCollapse(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function openDetail(row: DisplayRow, columnIndex: number | null) {
    if (isMonthly) setDetail({ rowKey: row.key, year, month: columnIndex })
    else if (columnIndex !== null) setDetail({ rowKey: row.key, year: pl.columns[columnIndex], month: null })
  }

  function handleDownload() {
    downloadProfitLossWorkbook(pl, isMonthly ? { kind: 'monthly', year } : { kind: 'yearly' }).catch((e) =>
      window.alert(e instanceof Error ? e.message : '다운로드 중 오류가 발생했습니다.'),
    )
  }

  function formatCell(value: number, revenueValue: number): string {
    if (showRatio) {
      const ratio = ratioOf(value, revenueValue)
      return ratio === null ? '-' : `${ratio.toFixed(1)}%`
    }
    return value === 0 ? '-' : formatNumber(value)
  }

  return (
    <div className="receipts-scope app">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">손익계산서</h1>
        <p className="text-sm text-muted-foreground">
          확정된 세금계산서·영수증과 수기 항목으로 손익을 계산해요. 연도별·월별로 볼 수 있고, 금액 칸을 누르면 월별
          금액과 근거 자료를 확인할 수 있어요.
        </p>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <SummaryCard label={`${cardYear}년 매출액`} value={cardValue(revenue)} />
        {(
          [
            ['매출총이익', pl.grossProfit],
            ['영업이익', pl.operatingIncome],
            ['당기순이익(세전)', pl.netIncome],
          ] as const
        ).map(([label, series]) => (
          <SummaryCard
            key={label}
            label={`${cardYear}년 ${label}`}
            value={cardValue(series)}
            ratio={ratioOf(cardValue(series), cardValue(revenue))}
          />
        ))}
      </div>

      {unclassifiedCount > 0 && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-warning-foreground/20 bg-warning px-4 py-3 text-sm text-warning-foreground">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            세부내역이 비어 있거나 공사/제조/상품/사무실/SC본사가 아닌 매입이 {unclassifiedCount}건(
            {formatNumber(unclassified.total)}원) 있어요. 영업이익에는 비용으로 빼 두었어요. 정리 화면에서 세부내역을 채우고
            다시 확정해 주세요.
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3 text-sm">
        <PillGroup
          label="조회 단위"
          value={mode}
          options={[
            ['yearly', '연도별'],
            ['monthly', '월별'],
          ]}
          onChange={setMode}
        />
        {isMonthly && (
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">연도</span>
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="h-8 w-28 rounded-md border border-input bg-transparent px-2 text-sm"
            >
              {yearsDesc.map((y) => (
                <option key={y} value={y}>
                  {y}년
                </option>
              ))}
            </select>
          </label>
        )}
        <PillGroup
          label="표시"
          value={showRatio ? 'ratio' : 'amount'}
          options={[
            ['amount', '금액'],
            ['ratio', '매출 대비 %'],
          ]}
          onChange={(v) => setShowRatio(v === 'ratio')}
        />
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={() => setManualOpen(true)} className="h-8 px-4 py-0">
            수기 항목 {manual.length > 0 && `(${manual.length})`}
          </Button>
          <Button onClick={handleDownload} className="h-8 px-4 py-0">
            엑셀 다운
          </Button>
        </div>
      </div>

      <div className={cn('max-h-[70vh] overflow-auto rounded-lg border bg-card', !isMonthly && 'w-fit max-w-full')}>
        {/* 억 단위 금액(예: 526,457,061)이 잘리지 않는 고정 폭으로 둔다. 월별은 열이 많아 화면이 좁으면 항목·합계
            열을 고정한 채 가로 스크롤하고, 연도별은 열이 적어 표 너비를 내용만큼만 쓴다. */}
        <table
          className={cn(
            'table-fixed border-separate border-spacing-0 text-[13px]',
            isMonthly && 'w-full min-w-[1560px]',
          )}
          style={isMonthly ? undefined : { width: YEARLY_LABEL_WIDTH + YEARLY_COLUMN_WIDTH * pl.columns.length }}
        >
          <colgroup>
            <col className={isMonthly ? 'w-40' : undefined} style={isMonthly ? undefined : { width: YEARLY_LABEL_WIDTH }} />
            {pl.columns.map((key) => (
              <col
                key={key}
                className={isMonthly ? 'w-[104px]' : undefined}
                style={isMonthly ? undefined : { width: YEARLY_COLUMN_WIDTH }}
              />
            ))}
            {isMonthly && <col className="w-[120px]" />}
          </colgroup>
          <thead className="sticky top-0 z-10 bg-muted text-xs text-muted-foreground">
            <tr>
              <th className="sticky left-0 z-10 bg-muted px-3 py-1.5 text-left font-medium">항목</th>
              {columnHeaders.map((h) => (
                <th key={h.label} className="px-2 py-1.5 text-right font-medium">
                  <div>{h.label}</div>
                  <ConfirmBadge status={h.status} tooltip={h.tooltip} />
                </th>
              ))}
              {isMonthly && <th className="sticky right-0 z-10 bg-muted px-3 py-1.5 text-right font-medium">합계</th>}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => {
              const isLine = row.kind === 'line'
              const isProfit = row.kind === 'profit'
              const collapsible = row.collapseKey !== undefined && (row.kind === 'group' || rowHasChildren(rows, row))
              const isCollapsed = row.collapseKey !== undefined && collapsed.has(row.collapseKey)
              // 가로 스크롤 시 고정되는 항목/합계 열도 같은 배경을 쓰므로 뒤 칸이 비치지 않게 불투명 색만 쓴다.
              const rowBg = isProfit ? 'bg-accent' : isLine ? 'bg-card' : 'bg-muted'
              return (
                <tr key={row.key} className={cn(rowBg, !isLine && 'font-semibold', row.warning && 'text-warning-foreground')}>
                  <td
                    className={cn('sticky left-0 truncate border-t px-3 py-1.5', rowBg)}
                    style={{ paddingLeft: `${12 + row.depth * 16}px` }}
                  >
                    {collapsible ? (
                      <button
                        type="button"
                        onClick={() => toggleCollapse(row.collapseKey!)}
                        className="inline-flex items-center gap-1"
                        aria-expanded={!isCollapsed}
                      >
                        {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        {row.label}
                      </button>
                    ) : (
                      <span className={cn(!isLine && 'pl-[18px]')}>{row.label}</span>
                    )}
                    {row.line?.hasManual && (
                      <span className="ml-1.5 rounded-full border px-1.5 text-[10px] font-normal text-muted-foreground">
                        수기
                      </span>
                    )}
                  </td>
                  {row.values.map((v, i) => (
                    <AmountCell
                      key={i}
                      text={formatCell(v, revenue.values[i])}
                      negative={v < 0}
                      onClick={v !== 0 ? () => openDetail(row, i) : undefined}
                    />
                  ))}
                  {isMonthly && (
                    <AmountCell
                      text={formatCell(row.total, revenue.total)}
                      negative={row.total < 0}
                      strong
                      className={cn('sticky right-0', rowBg)}
                      onClick={row.total !== 0 ? () => openDetail(row, null) : undefined}
                    />
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {detail && (
        <SourceDetailModal
          key={`${detail.rowKey}|${detail.year}|${detail.month}`}
          target={detail}
          data={data}
          showRatio={showRatio}
          onClose={() => setDetail(null)}
        />
      )}
      {manualOpen && (
        <ProfitLossManualPanel
          entries={manual}
          initialMonth={defaultManualMonth}
          accountSuggestions={accountSuggestions}
          onClose={() => setManualOpen(false)}
        />
      )}
    </div>
  )
}

function rowHasChildren(rows: DisplayRow[], row: DisplayRow): boolean {
  return rows.some((r) => r.parentKeys.includes(row.collapseKey!))
}

function PillGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: [T, string][]
  onChange: (value: T) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1">
        {options.map(([v, text]) => (
          <button
            type="button"
            key={v}
            onClick={() => onChange(v)}
            className={cn(
              'h-8 whitespace-nowrap rounded-full border px-3 text-sm transition-colors',
              value === v ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-transparent hover:bg-muted',
            )}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  )
}

function SummaryCard({ label, value, ratio }: { label: string; value: number; ratio?: number | null }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn('mt-1 text-2xl font-semibold tabular-nums', value < 0 && 'text-destructive')}>
        {formatNumber(value)}원
      </div>
      {ratio !== undefined && (
        <div className="mt-1 text-xs text-muted-foreground tabular-nums">
          매출 대비 {ratio === null ? '-' : `${ratio.toFixed(1)}%`}
        </div>
      )}
    </div>
  )
}

function ConfirmBadge({ status, tooltip }: { status: ConfirmStatus; tooltip: string }) {
  const text = status === 'confirmed' ? '확정' : status === 'none' ? '미확정' : '일부 미확정'
  return (
    <div
      className={cn(
        'text-[10px] font-normal',
        status === 'confirmed' && 'text-primary',
        status === 'none' && 'text-muted-foreground/70',
        status === 'partial' && 'text-warning-foreground',
      )}
      title={tooltip}
    >
      {text}
    </div>
  )
}

function AmountCell({
  text,
  negative,
  strong,
  className,
  onClick,
}: {
  text: string
  negative: boolean
  strong?: boolean
  className?: string
  onClick?: () => void
}) {
  return (
    <td
      className={cn(
        'whitespace-nowrap border-t px-2 py-1.5 text-right tabular-nums',
        strong && 'font-semibold',
        negative && 'text-destructive',
        onClick && 'cursor-pointer hover:bg-muted hover:underline',
        className,
      )}
      onClick={onClick}
    >
      {text}
    </td>
  )
}

// 상세 모달: 위에는 그 행의 해당 연도 1~12월 금액 띠, 아래에는 원천 자료 목록. 월 칸을 누르면 목록이 그 달로
// 좁혀지고 다시 누르면 연간 전체로 돌아간다. 이익 줄은 원천 자료가 여러 구분에 걸쳐 있어 월별 금액만 보여준다.
function SourceDetailModal({
  target,
  data,
  showRatio,
  onClose,
}: {
  target: DetailTarget
  data: ProfitLossSourceData
  showRatio: boolean
  onClose: () => void
}) {
  const [monthFilter, setMonthFilter] = useState<number | null>(target.month)
  const monthlyPl = useMemo(() => monthlyProfitLoss(data, target.year), [data, target.year])
  const row = useMemo(
    () => flattenProfitLoss(monthlyPl).find((r) => r.key === target.rowKey),
    [monthlyPl, target.rowKey],
  )
  if (!row) return null

  const isProfit = row.kind === 'profit'
  const showAccount = row.kind === 'section' || row.kind === 'group'
  const monthRevenue = monthlyPl.sections.REVENUE.values
  const allItems = isProfit ? [] : rowSourceItems(monthlyPl, row)
  const monthKey = monthFilter === null ? null : monthlyPl.columns[monthFilter]
  const items = monthKey === null ? allItems : allItems.filter((it) => it.monthKey === monthKey)
  const total = items.reduce((s, it) => s + it.amount, 0)
  const sectionLabel = row.kind === 'line' && row.section ? `${SECTION_LABEL[row.section]} · ` : ''
  const format = (v: number, rev: number) => {
    if (showRatio) {
      const ratio = ratioOf(v, rev)
      return ratio === null ? '-' : `${ratio.toFixed(1)}%`
    }
    return v === 0 ? '-' : formatNumber(v)
  }

  return (
    <Modal title={`${target.year}년 · ${sectionLabel}${row.label}`} onClose={onClose}>
      <div className="mb-4 overflow-x-auto rounded-lg border bg-card">
        <table className="w-full min-w-[1100px] table-fixed text-[13px]">
          <thead className="bg-muted text-xs text-muted-foreground">
            <tr>
              {MONTH_NUMBERS.map((m) => (
                <th key={m} className="px-2 py-1.5 text-right font-medium">
                  {m}월
                </th>
              ))}
              <th className="px-2 py-1.5 text-right font-medium">합계</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              {row.values.map((v, i) => {
                const selected = monthFilter === i
                const clickable = !isProfit && v !== 0
                return (
                  <td
                    key={i}
                    onClick={clickable ? () => setMonthFilter(selected ? null : i) : undefined}
                    className={cn(
                      'whitespace-nowrap px-2 py-2 text-right tabular-nums',
                      v < 0 && 'text-destructive',
                      clickable && 'cursor-pointer hover:bg-muted hover:underline',
                      selected && 'bg-accent font-semibold ring-1 ring-inset ring-primary',
                    )}
                  >
                    {format(v, monthRevenue[i])}
                  </td>
                )
              })}
              <td
                onClick={!isProfit && monthFilter !== null ? () => setMonthFilter(null) : undefined}
                className={cn(
                  'whitespace-nowrap px-2 py-2 text-right font-semibold tabular-nums',
                  row.total < 0 && 'text-destructive',
                  !isProfit && monthFilter !== null && 'cursor-pointer hover:bg-muted hover:underline',
                  !isProfit && monthFilter === null && 'bg-accent',
                )}
              >
                {format(row.total, monthlyPl.sections.REVENUE.total)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {isProfit ? (
        <p className="text-sm text-muted-foreground">
          이익 줄은 여러 구분을 더하고 뺀 값이라 근거 자료 목록 대신 월별 금액만 보여드려요. 매출액·원가·판매관리비 줄을
          눌러 근거 자료를 확인해 주세요.
        </p>
      ) : (
        <>
          <p className="mb-2 text-sm text-muted-foreground">
            {monthFilter === null
              ? '연간 전체 자료예요. 위의 월 칸을 누르면 그 달 자료만 볼 수 있어요.'
              : `${monthFilter + 1}월 자료예요. 같은 칸이나 합계를 다시 누르면 연간 전체로 돌아가요.`}{' '}
            불공제 세금계산서와 불공·간이 영수증은 부가세까지 비용으로 보고 합계금액을 반영했어요.
          </p>
          <div className="max-h-[50vh] overflow-auto rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-1.5 text-left font-medium">자료</th>
                  <th className="px-3 py-1.5 text-left font-medium">일자</th>
                  {showAccount && <th className="px-3 py-1.5 text-left font-medium">계정과목</th>}
                  <th className="px-3 py-1.5 text-left font-medium">거래처</th>
                  <th className="px-3 py-1.5 text-left font-medium">품목/내역/메모</th>
                  <th className="px-3 py-1.5 text-left font-medium">세부내역</th>
                  <th className="px-3 py-1.5 text-left font-medium">과세유형</th>
                  <th className="px-3 py-1.5 text-right font-medium">반영금액</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={`${it.kind}:${it.id}`} className="border-t">
                    <td className="whitespace-nowrap px-3 py-1.5">{SOURCE_KIND_LABEL[it.kind]}</td>
                    <td className="whitespace-nowrap px-3 py-1.5 tabular-nums">{it.date}</td>
                    {showAccount && <td className="whitespace-nowrap px-3 py-1.5">{it.accountCode}</td>}
                    <td className="px-3 py-1.5">{it.counterparty}</td>
                    <td className="px-3 py-1.5">{it.description}</td>
                    <td className="px-3 py-1.5">{it.detail}</td>
                    <td className="px-3 py-1.5">{it.taxType}</td>
                    <td className={cn('px-3 py-1.5 text-right tabular-nums', it.amount < 0 && 'text-destructive')}>
                      {formatNumber(it.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted font-semibold">
                <tr>
                  <td colSpan={showAccount ? 7 : 6} className="px-3 py-1.5">
                    합계 ({items.length}건)
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{formatNumber(total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </Modal>
  )
}
