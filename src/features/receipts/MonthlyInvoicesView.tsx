'use client'

import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import './receipts.css'
import { Table } from './components/Table'
import { createTaxInvoiceColumns } from './components/taxInvoiceColumns'
import { downloadPurchaseWorkbook, downloadSalesWorkbook } from './lib/exportWorkbook'
import { taxInvoiceFooterCells } from './lib/footerCells'
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

      <Table columns={columns} rows={filteredRows} hideSearch footerCells={taxInvoiceFooterCells} />
    </div>
  )
}
