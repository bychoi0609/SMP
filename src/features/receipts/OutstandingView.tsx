'use client'

import { useMemo, useState, useTransition } from 'react'
import { cn } from '@/lib/utils'
import './receipts.css'
import { Table } from './components/Table'
import { createTaxInvoiceColumns } from './components/taxInvoiceColumns'
import { DateCell } from './components/cellInputs'
import { downloadPurchaseWorkbook, downloadSalesWorkbook } from './lib/exportWorkbook'
import { taxInvoiceFooterCells } from './lib/footerCells'
import { formatNumber } from './lib/format'
import {
  agingBucketOf,
  counterpartyKeyOf,
  daysSince,
  groupOutstandingByCounterparty,
  isOutstanding,
  type AgingBucket,
} from './lib/outstanding'
import { setConfirmedTaxInvoicePaymentDateAction, type TaxInvoiceRowDTO } from '@/app/receipts/actions'
import type { TaxInvoiceDirection } from './types/tables'
import { Button } from './components/ui/button'

const AGING_BUCKETS: AgingBucket[] = ['30일 이내', '31~60일', '61~90일', '90일 초과']

interface OutstandingViewProps {
  initialSalesRows: TaxInvoiceRowDTO[]
  initialPurchaseRows: TaxInvoiceRowDTO[]
  today: string // 'YYYY-MM-DD' (한국시간) — 경과일 계산 기준
}

function sumTotal(rows: { totalAmount: number }[]) {
  return rows.reduce((acc, r) => acc + r.totalAmount, 0)
}

// 확정된 세금계산서 중 아직 돈이 들어오지 않은 매출(외상매출금)과 아직 돈이 나가지 않은 매입
// (외상매입금/미지급금)을 모아 보는 화면. 판단 규칙은 lib/outstanding.ts 참조. 상세 표에서는 결제일만
// 바로 입력할 수 있고, 입력하면 확정 데이터와 정리 화면 draft에 함께 저장된 뒤 목록에서 빠진다.
export default function OutstandingView({
  initialSalesRows,
  initialPurchaseRows,
  today: todayIso,
}: OutstandingViewProps) {
  const [direction, setDirection] = useState<TaxInvoiceDirection>('sales')
  const [startMonth, setStartMonth] = useState('')
  const [endMonth, setEndMonth] = useState('')
  const [appliedRange, setAppliedRange] = useState<{ start: string; end: string }>({ start: '', end: '' })
  const [agingFilter, setAgingFilter] = useState<AgingBucket | 'all'>('all')
  const [selectedCounterparty, setSelectedCounterparty] = useState<string | null>(null)
  // 결제일 입력 결과를 바로 반영하기 위해 서버에서 받은 행을 로컬 상태로 들고 있는다.
  const [salesRows, setSalesRows] = useState(initialSalesRows)
  const [purchaseRows, setPurchaseRows] = useState(initialPurchaseRows)
  const [paymentNotice, setPaymentNotice] = useState<{
    message: string
    tone: 'info' | 'error'
    undo?: { id: number; previous: string }
  } | null>(null)
  const [isSavingPayment, startSavingPayment] = useTransition()
  const today = useMemo(() => {
    const [y, m, d] = todayIso.split('-').map(Number)
    return new Date(y, m - 1, d)
  }, [todayIso])

  const receivables = useMemo(() => salesRows.filter((r) => isOutstanding(r, 'sales')), [salesRows])
  const payables = useMemo(() => purchaseRows.filter((r) => isOutstanding(r, 'purchase')), [purchaseRows])

  // 기간(귀속월) + 경과일 구간까지 적용한 행 — 거래처별 요약과 상세 표가 모두 이 행을 기준으로 한다.
  const rangeRows = useMemo(() => {
    const base = direction === 'sales' ? receivables : payables
    return base.filter((r) => {
      const month = r.writtenDate.slice(0, 7)
      if (appliedRange.start && month < appliedRange.start) return false
      if (appliedRange.end && month > appliedRange.end) return false
      if (agingFilter !== 'all' && agingBucketOf(daysSince(r.writtenDate, today)) !== agingFilter) return false
      return true
    })
  }, [direction, receivables, payables, appliedRange, agingFilter, today])

  const counterparties = useMemo(() => groupOutstandingByCounterparty(rangeRows, today), [rangeRows, today])

  const detailRows = useMemo(
    () =>
      rangeRows
        .filter((r) => selectedCounterparty === null || counterpartyKeyOf(r) === selectedCounterparty)
        .map((r, i) => ({ ...r, no: i + 1 })),
    [rangeRows, selectedCounterparty],
  )

  function savePaymentDate(id: number, paymentDate: string, isUndo = false) {
    const all = [...salesRows, ...purchaseRows]
    const target = all.find((r) => r.id === id)
    if (!target || target.paymentDate === paymentDate) return
    const previous = target.paymentDate
    const apply = (value: string) => {
      const patch = (rows: TaxInvoiceRowDTO[]) => rows.map((r) => (r.id === id ? { ...r, paymentDate: value } : r))
      setSalesRows(patch)
      setPurchaseRows(patch)
    }

    apply(paymentDate)
    startSavingPayment(async () => {
      const result = await setConfirmedTaxInvoicePaymentDateAction(id, paymentDate).catch(() => ({
        error: '결제일 저장 중 오류가 발생했습니다.',
        draftSynced: undefined,
      }))
      if (result.error) {
        apply(previous)
        setPaymentNotice({ message: result.error, tone: 'error' })
        return
      }
      const draftWarning =
        result.draftSynced === false
          ? ' (정리 화면 작업 데이터에서 같은 건을 찾지 못해 확정 데이터에만 저장했어요.)'
          : ''
      setPaymentNotice(
        isUndo
          ? { message: `"${target.counterpartyName}" 건의 결제일 입력을 되돌렸어요.${draftWarning}`, tone: 'info' }
          : {
              message: `"${target.counterpartyName}" ${formatNumber(target.totalAmount)}원 건의 결제일을 ${paymentDate}로 저장했어요. 목록에서 빠졌어요.${draftWarning}`,
              tone: 'info',
              undo: { id, previous },
            },
      )
    })
  }

  // 조회 전용 컬럼에서 결제일 칸만 입력창으로 바꾼다.
  const columns = useMemo(
    () =>
      createTaxInvoiceColumns({ direction, readOnly: true }).map((col) =>
        col.key === 'paymentDate'
          ? {
              ...col,
              render: (_row: unknown, i: number) => {
                const row = detailRows[i]
                if (!row) return null
                return <DateCell value={row.paymentDate} onChange={(v) => savePaymentDate(row.id, v)} />
              },
            }
          : col,
      ),
    // savePaymentDate는 매 렌더 새로 만들어지지만 detailRows가 바뀔 때 함께 갱신되면 충분하다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [direction, detailRows],
  )

  const receivableOver90 = receivables.filter((r) => daysSince(r.writtenDate, today) > 90)
  const payableOver90 = payables.filter((r) => daysSince(r.writtenDate, today) > 90)
  const payableByAccount = (account: string) =>
    sumTotal(payables.filter((r) => r.paymentBasisAccount.trim() === account))

  function switchDirection(next: TaxInvoiceDirection) {
    setDirection(next)
    setSelectedCounterparty(null)
  }

  function handleSearch() {
    setAppliedRange({ start: startMonth, end: endMonth })
    setSelectedCounterparty(null)
  }

  function handleDownload() {
    const promise = direction === 'sales' ? downloadSalesWorkbook(detailRows) : downloadPurchaseWorkbook(detailRows)
    promise.catch((e) => window.alert(e instanceof Error ? e.message : '다운로드 중 오류가 발생했습니다.'))
  }

  return (
    <div className="receipts-scope app">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">미수·미지급 현황</h1>
        <p className="text-sm text-muted-foreground">
          확정된 세금계산서 중 결제일이 비어 있는 외상매출금(받을 돈)과 외상매입금·미지급금(줄 돈)을 모아 보여드려요.
        </p>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => switchDirection('sales')}
          className={cn(
            'rounded-xl border bg-card p-4 text-left shadow-sm transition-colors',
            direction === 'sales' ? 'border-primary ring-1 ring-primary' : 'hover:bg-muted/50',
          )}
        >
          <div className="text-xs text-muted-foreground">받을 돈 (외상매출금)</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{formatNumber(sumTotal(receivables))}원</div>
          <div className="mt-1 text-xs text-muted-foreground">{receivables.length}건</div>
        </button>
        <button
          type="button"
          onClick={() => switchDirection('purchase')}
          className={cn(
            'rounded-xl border bg-card p-4 text-left shadow-sm transition-colors',
            direction === 'purchase' ? 'border-primary ring-1 ring-primary' : 'hover:bg-muted/50',
          )}
        >
          <div className="text-xs text-muted-foreground">줄 돈 (외상매입금·미지급금)</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{formatNumber(sumTotal(payables))}원</div>
          <div className="mt-1 text-xs text-muted-foreground tabular-nums">
            {payables.length}건 · 외상매입금 {formatNumber(payableByAccount('외상매입금'))} · 미지급금{' '}
            {formatNumber(payableByAccount('미지급금'))}
          </div>
        </button>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="text-xs text-muted-foreground">90일 넘게 정리되지 않은 건</div>
          <div className="mt-1 text-sm tabular-nums">
            받을 돈 <span className="font-semibold">{formatNumber(sumTotal(receivableOver90))}원</span> (
            {receivableOver90.length}건)
          </div>
          <div className="mt-1 text-sm tabular-nums">
            줄 돈 <span className="font-semibold">{formatNumber(sumTotal(payableOver90))}원</span> (
            {payableOver90.length}건)
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">기간(시작)</span>
          <input
            type="month"
            value={startMonth}
            onChange={(e) => setStartMonth(e.target.value)}
            className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
          />
        </label>
        <span className="pb-1.5">~</span>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">기간(종료)</span>
          <input
            type="month"
            value={endMonth}
            onChange={(e) => setEndMonth(e.target.value)}
            className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
          />
        </label>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">경과일</span>
          <div className="flex items-center gap-1">
            {(['all', ...AGING_BUCKETS] as const).map((b) => (
              <button
                type="button"
                key={b}
                onClick={() => setAgingFilter(b)}
                className={cn(
                  'h-8 whitespace-nowrap rounded-full border px-3 text-sm transition-colors',
                  agingFilter === b
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input bg-transparent hover:bg-muted',
                )}
              >
                {b === 'all' ? '전체' : b}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1 ml-auto mr-4">
          <span className="text-xs text-transparent select-none">조회</span>
          <Button onClick={handleSearch} className="h-8 px-4 py-0">
            조회
          </Button>
        </div>
        <div className="flex flex-col gap-1 -ml-4 mr-2">
          <span className="text-xs text-transparent select-none">다운로드</span>
          <Button onClick={handleDownload} className="h-8 px-4 py-0">
            엑셀 다운
          </Button>
        </div>
      </div>

      <div className="mb-4 rounded-lg border bg-card">
        <div className="flex items-center justify-between px-3 py-2 text-sm">
          <span className="font-medium">거래처별 {direction === 'sales' ? '받을 돈' : '줄 돈'}</span>
          <span className="text-xs text-muted-foreground">
            {selectedCounterparty === null
              ? '거래처를 누르면 아래 상세 내역이 그 거래처로 좁혀져요.'
              : '같은 거래처를 한 번 더 누르면 전체로 돌아가요.'}
          </span>
        </div>
        <div className="max-h-80 overflow-auto">
          {/* 6칼럼을 거의 균등하게 나누되 거래처명만 조금 더 넓게(20% + 16%×5). 좁은 화면에서는 724px 아래로
              줄어들지 않고 가로 스크롤된다. */}
          <table className="w-full min-w-[724px] table-fixed text-sm">
            <colgroup>
              <col className="w-[20%]" />
              <col className="w-[16%]" />
              <col className="w-[16%]" />
              <col className="w-[16%]" />
              <col className="w-[16%]" />
              <col className="w-[16%]" />
            </colgroup>
            <thead className="sticky top-0 bg-muted text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-1.5 text-left font-medium">거래처명</th>
                <th className="px-3 py-1.5 text-left font-medium">사업자등록번호</th>
                <th className="px-3 py-1.5 text-right font-medium">건수</th>
                <th className="px-3 py-1.5 text-right font-medium">합계금액</th>
                <th className="px-3 py-1.5 text-left font-medium">최초 작성일</th>
                <th className="px-3 py-1.5 text-right font-medium">경과일</th>
              </tr>
            </thead>
            <tbody>
              {counterparties.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                    {direction === 'sales' ? '받을 돈' : '줄 돈'}이 남아 있는 건이 없어요.
                  </td>
                </tr>
              )}
              {counterparties.map((c) => (
                <tr
                  key={c.key}
                  onClick={() => setSelectedCounterparty((prev) => (prev === c.key ? null : c.key))}
                  className={cn(
                    'cursor-pointer border-t hover:bg-muted/50',
                    selectedCounterparty === c.key && 'bg-secondary',
                  )}
                >
                  <td className="truncate px-3 py-1.5" title={c.counterpartyName}>
                    {c.counterpartyName}
                  </td>
                  <td className="px-3 py-1.5 tabular-nums">{c.counterpartyBizNo}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{c.count}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{formatNumber(c.totalAmount)}</td>
                  <td className="px-3 py-1.5 tabular-nums">{c.oldestWrittenDate}</td>
                  <td className={cn('px-3 py-1.5 text-right tabular-nums', c.maxDays > 90 && 'font-semibold text-destructive')}>
                    {c.maxDays}일
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {paymentNotice && (
        <div
          className={cn(
            'mb-2 flex items-center gap-3 rounded-lg border px-3 py-2 text-sm',
            paymentNotice.tone === 'error' ? 'border-destructive/40 text-destructive' : 'bg-secondary',
          )}
        >
          <span className="flex-1">{paymentNotice.message}</span>
          {paymentNotice.undo && (
            <Button
              variant="outline"
              disabled={isSavingPayment}
              onClick={() => savePaymentDate(paymentNotice.undo!.id, paymentNotice.undo!.previous, true)}
            >
              되돌리기
            </Button>
          )}
          <Button variant="ghost" onClick={() => setPaymentNotice(null)}>
            닫기
          </Button>
        </div>
      )}
      <p className="mb-2 text-xs text-muted-foreground">
        상세 내역의 결제일 칸에 날짜를 입력하면(예: 2026-09-30, 20260930, 260930) 바로 저장되고 목록에서 빠져요.
      </p>
      <Table columns={columns} rows={detailRows} hideSearch footerCells={taxInvoiceFooterCells} />
    </div>
  )
}
