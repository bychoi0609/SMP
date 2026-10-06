'use client'

import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import './receipts.css'
import { Table } from './components/Table'
import { createTaxInvoiceColumns } from './components/taxInvoiceColumns'
import { downloadPurchaseWorkbook, downloadSalesWorkbook } from './lib/exportWorkbook'
import { taxInvoiceFooterCells } from './lib/footerCells'
import { SummaryPanel } from './components/SummaryPanel'
import type { SummaryDimension, SummaryStat } from './components/SummaryPanel'
import { groupTotals, summarizeTaxInvoiceTotals } from './lib/summarize'
import { formatNumber } from './lib/format'
import type { TaxInvoiceRowDTO } from '@/app/receipts/actions'
import { Button } from './components/ui/button'

type Direction = 'sales' | 'purchase'
type SearchCategory = 'all' | 'counterpartyName' | 'itemName' | 'accountCode' | 'detail'

interface MonthlyInvoicesViewProps {
  initialSalesRows: TaxInvoiceRowDTO[]
  initialPurchaseRows: TaxInvoiceRowDTO[]
}

// 정리 화면에서 확정된(DB에 저장된) 매출/매입 세금계산서를 기간(귀속월 범위)으로 조회하는 화면.
// 편집은 /receipts의 세금계산서 모달에서만 한다 — 여기서는 조회 전용.
export default function MonthlyInvoicesView({ initialSalesRows, initialPurchaseRows }: MonthlyInvoicesViewProps) {
  const [direction, setDirection] = useState<Direction>('sales')
  const [startMonth, setStartMonth] = useState('')
  const [endMonth, setEndMonth] = useState('')
  const [category, setCategory] = useState<SearchCategory>('all')
  const [searchText, setSearchText] = useState('')
  const [appliedRange, setAppliedRange] = useState<{ start: string; end: string }>({ start: '', end: '' })
  const [appliedSearch, setAppliedSearch] = useState<{ category: SearchCategory; text: string }>({
    category: 'all',
    text: '',
  })

  const rows = direction === 'sales' ? initialSalesRows : initialPurchaseRows

  // "번호" 컬럼은 화면 표시 순번으로 다시 매긴다(DB id는 표시/다운로드 출력 대상이 아님).
  const filteredRows = useMemo(() => {
    const q = appliedSearch.text.trim().toLowerCase()

    return rows
      .filter((r) => {
        const month = r.writtenDate.slice(0, 7)
        if (appliedRange.start && month < appliedRange.start) return false
        if (appliedRange.end && month > appliedRange.end) return false
        return true
      })
      .filter((r) => {
        if (!q) return true
        const matchesCounterparty = r.counterpartyName.toLowerCase().includes(q)
        const matchesItem = r.itemName.toLowerCase().includes(q)
        const matchesAccountCode = r.accountCode.toLowerCase().includes(q)
        const matchesDetail = r.detail.toLowerCase().includes(q)
        if (appliedSearch.category === 'counterpartyName') return matchesCounterparty
        if (appliedSearch.category === 'itemName') return matchesItem
        if (appliedSearch.category === 'accountCode') return matchesAccountCode
        if (appliedSearch.category === 'detail') return matchesDetail
        return matchesCounterparty || matchesItem || matchesAccountCode || matchesDetail
      })
      .map((r, i) => ({ ...r, no: i + 1 }))
  }, [rows, appliedRange, appliedSearch])

  const columns = useMemo(() => createTaxInvoiceColumns({ direction, readOnly: true }), [direction])

  const totals = useMemo(() => summarizeTaxInvoiceTotals(filteredRows), [filteredRows])

  const summaryStats: SummaryStat[] = [
    { label: '합계금액', value: `${formatNumber(totals.total)}원` },
    { label: '공급가액', value: formatNumber(totals.supply) },
    { label: '세액', value: formatNumber(totals.tax) },
    { label: '건수', value: `${formatNumber(totals.count)}건` },
    ...(totals.unpaid > 0
      ? [
          {
            label: direction === 'sales' ? '미수(결제일 빈 행)' : '미지급(결제일 빈 행)',
            value: `${totals.unpaid}건`,
            tone: 'warning' as const,
          },
        ]
      : []),
    ...(direction === 'purchase' && totals.nonDeductibleCount > 0
      ? [{ label: '불공', value: `${totals.nonDeductibleCount}건 · 세액 ${formatNumber(totals.nonDeductibleTax)}` }]
      : []),
  ]

  // 집계 카드의 항목을 누르면 해당 값으로 검색 조건을 채워 바로 조회한다(기간은 현재 적용된 값 유지).
  // 이미 그 조건으로 걸러진 항목을 다시 누르면 검색어를 비워 필터를 해제한다.
  function selectSummaryItem(nextCategory: Exclude<SearchCategory, 'all'>, key: string) {
    const isActive = appliedSearch.category === nextCategory && appliedSearch.text === key
    const nextText = isActive ? '' : key
    const nextSearchCategory: SearchCategory = isActive ? 'all' : nextCategory
    setCategory(nextSearchCategory)
    setSearchText(nextText)
    setAppliedSearch({ category: nextSearchCategory, text: nextText })
  }

  const activeKey = (c: SearchCategory) =>
    appliedSearch.category === c && appliedSearch.text ? appliedSearch.text : null
  // 매출은 거래처별/계정과목별만, 매입은 세부내역별까지 보여준다.
  const summaryDimensions: SummaryDimension[] = [
    {
      title: '거래처별',
      groups: groupTotals(filteredRows, (r) => r.counterpartyName),
      activeKey: activeKey('counterpartyName'),
      onSelect: (key) => selectSummaryItem('counterpartyName', key),
    },
    {
      title: '계정과목별',
      groups: groupTotals(filteredRows, (r) => r.accountCode),
      activeKey: activeKey('accountCode'),
      onSelect: (key) => selectSummaryItem('accountCode', key),
    },
    ...(direction === 'purchase'
      ? [
          {
            title: '세부내역별',
            groups: groupTotals(filteredRows, (r) => r.detail),
            activeKey: activeKey('detail'),
            onSelect: (key: string) => selectSummaryItem('detail', key),
          },
        ]
      : []),
  ]

  function handleSearch() {
    setAppliedRange({ start: startMonth, end: endMonth })
    setAppliedSearch({ category, text: searchText })
  }

  function handleDownload() {
    const promise = direction === 'sales' ? downloadSalesWorkbook(filteredRows) : downloadPurchaseWorkbook(filteredRows)
    promise.catch((e) => window.alert(e instanceof Error ? e.message : '다운로드 중 오류가 발생했습니다.'))
  }

  return (
    <div className="receipts-scope app">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">월별 세금계산서 데이터</h1>
        <p className="text-sm text-muted-foreground">
          정리 화면에서 확정된 매출/매입 세금계산서 데이터를 기간별로 조회합니다(조회 전용).
        </p>
      </div>

      <div className="tabs-row">
        <nav className="main-tabs">
          <button type="button" className={direction === 'sales' ? 'active' : ''} onClick={() => setDirection('sales')}>
            세금계산서(매출) {initialSalesRows.length > 0 && `(${initialSalesRows.length})`}
          </button>
          <button
            type="button"
            className={direction === 'purchase' ? 'active' : ''}
            onClick={() => setDirection('purchase')}
          >
            세금계산서(매입) {initialPurchaseRows.length > 0 && `(${initialPurchaseRows.length})`}
          </button>
        </nav>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">기간(시작)</span>
          <input
            type="month"
            value={startMonth}
            onChange={(e) => setStartMonth(e.target.value)}
            className="rounded-md border border-input bg-transparent px-2 py-1"
          />
        </label>
        <span className="pb-1.5">~</span>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">기간(종료)</span>
          <input
            type="month"
            value={endMonth}
            onChange={(e) => setEndMonth(e.target.value)}
            className="rounded-md border border-input bg-transparent px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">검색 조건</span>
          <div className="relative">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as SearchCategory)}
              className="w-32 appearance-none rounded-md border border-input bg-transparent py-1 pl-3 pr-8"
            >
              <option value="all">전체</option>
              <option value="counterpartyName">거래처명</option>
              <option value="itemName">품목명</option>
              <option value="accountCode">계정과목</option>
              <option value="detail">세부내역</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">검색어</span>
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="검색어 입력"
            className="rounded-md border border-input bg-transparent px-2 py-1"
          />
        </label>
        <div className="flex flex-col gap-1 ml-auto mr-4">
          <span className="text-xs text-transparent select-none">조회</span>
          <Button onClick={handleSearch} className="px-4 py-1">
            조회
          </Button>
        </div>
        <div className="flex flex-col gap-1 -ml-4 mr-2">
          <span className="text-xs text-transparent select-none">다운로드</span>
          <Button onClick={handleDownload} className="px-4 py-1">
            엑셀 다운
          </Button>
        </div>
      </div>

      {filteredRows.length > 0 && (
        <SummaryPanel
          key={direction}
          stats={summaryStats}
          grandTotal={totals.total}
          dimensions={summaryDimensions}
        />
      )}

      <Table columns={columns} rows={filteredRows} hideSearch footerCells={taxInvoiceFooterCells} />
    </div>
  )
}
