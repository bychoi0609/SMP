'use client'

import { useMemo, useState } from 'react'
import './receipts.css'
import { Table } from './components/Table'
import { createTaxInvoiceColumns } from './components/taxInvoiceColumns'
import { groupTaxInvoiceRowsByMonth } from './lib/groupTaxInvoiceByMonth'
import { usePersistentState } from './lib/storage'
import {
  downloadPurchaseMonthWorkbook,
  downloadPurchaseWorkbook,
  downloadSalesMonthWorkbook,
  downloadSalesWorkbook,
} from './lib/exportWorkbook'
import { taxInvoiceFooterCells } from './lib/footerCells'
import type { TaxInvoiceRow } from './types/tables'
import { Button } from './components/ui/button'

type Direction = 'sales' | 'purchase'

// 매출/매입 세금계산서를 저장된 상태 그대로(수정 불가) 월별로 또는 전체를 한 번에 보여주는
// 조회 전용 화면. 편집은 /receipts의 세금계산서 모달에서만 한다.
export default function MonthlyInvoicesView() {
  const [salesRows] = usePersistentState<TaxInvoiceRow[]>('salesRows', [])
  const [purchaseRows] = usePersistentState<TaxInvoiceRow[]>('purchaseRows', [])

  const [direction, setDirection] = useState<Direction>('sales')
  const [salesMonthFilter, setSalesMonthFilter] = useState('all')
  const [purchaseMonthFilter, setPurchaseMonthFilter] = useState('all')

  const salesMonthGroups = useMemo(() => groupTaxInvoiceRowsByMonth(salesRows), [salesRows])
  const purchaseMonthGroups = useMemo(() => groupTaxInvoiceRowsByMonth(purchaseRows), [purchaseRows])

  const effectiveSalesMonthFilter =
    salesMonthFilter === 'all' || salesMonthGroups.some((g) => g.month === salesMonthFilter)
      ? salesMonthFilter
      : 'all'
  const effectivePurchaseMonthFilter =
    purchaseMonthFilter === 'all' || purchaseMonthGroups.some((g) => g.month === purchaseMonthFilter)
      ? purchaseMonthFilter
      : 'all'

  const visibleSalesRows = useMemo(() => {
    if (effectiveSalesMonthFilter === 'all') return salesRows
    return salesMonthGroups.find((g) => g.month === effectiveSalesMonthFilter)?.rows ?? []
  }, [salesRows, salesMonthGroups, effectiveSalesMonthFilter])

  const visiblePurchaseRows = useMemo(() => {
    if (effectivePurchaseMonthFilter === 'all') return purchaseRows
    return purchaseMonthGroups.find((g) => g.month === effectivePurchaseMonthFilter)?.rows ?? []
  }, [purchaseRows, purchaseMonthGroups, effectivePurchaseMonthFilter])

  const salesColumns = useMemo(() => createTaxInvoiceColumns({ direction: 'sales', readOnly: true }), [])
  const purchaseColumns = useMemo(() => createTaxInvoiceColumns({ direction: 'purchase', readOnly: true }), [])

  function handleDownloadSales() {
    const promise =
      effectiveSalesMonthFilter === 'all'
        ? downloadSalesWorkbook(salesRows)
        : downloadSalesMonthWorkbook(visibleSalesRows, effectiveSalesMonthFilter)
    promise.catch((e) => window.alert(e instanceof Error ? e.message : '다운로드 중 오류가 발생했습니다.'))
  }
  function handleDownloadPurchase() {
    const promise =
      effectivePurchaseMonthFilter === 'all'
        ? downloadPurchaseWorkbook(purchaseRows)
        : downloadPurchaseMonthWorkbook(visiblePurchaseRows, effectivePurchaseMonthFilter)
    promise.catch((e) => window.alert(e instanceof Error ? e.message : '다운로드 중 오류가 발생했습니다.'))
  }

  return (
    <div className="receipts-scope app">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">월별 세금계산서 데이터</h1>
        <p className="text-sm text-muted-foreground">
          확정된 매출/매입 세금계산서 데이터를 월별로, 또는 전체를 한 번에 조회합니다(조회 전용).
        </p>
      </div>

      <div className="tabs-row">
        <nav className="main-tabs">
          <button
            type="button"
            className={direction === 'sales' ? 'active' : ''}
            onClick={() => setDirection('sales')}
          >
            세금계산서(매출) {salesRows.length > 0 && `(${salesRows.length})`}
          </button>
          <button
            type="button"
            className={direction === 'purchase' ? 'active' : ''}
            onClick={() => setDirection('purchase')}
          >
            세금계산서(매입) {purchaseRows.length > 0 && `(${purchaseRows.length})`}
          </button>
        </nav>
      </div>

      {direction === 'sales' ? (
        <Table
          columns={salesColumns}
          rows={visibleSalesRows}
          searchPlaceholder="거래처명/품목명/계정과목 검색..."
          toolbarExtra={<Button onClick={handleDownloadSales}>엑셀 다운</Button>}
          belowToolbar={
            <nav className="card-tabs">
              <button
                type="button"
                className={effectiveSalesMonthFilter === 'all' ? 'active' : ''}
                onClick={() => setSalesMonthFilter('all')}
              >
                전체
              </button>
              {salesMonthGroups.map((g) => (
                <button
                  type="button"
                  key={g.month}
                  className={g.month === effectiveSalesMonthFilter ? 'active' : ''}
                  onClick={() => setSalesMonthFilter(g.month)}
                >
                  {g.month}
                </button>
              ))}
            </nav>
          }
          footerCells={taxInvoiceFooterCells}
        />
      ) : (
        <Table
          columns={purchaseColumns}
          rows={visiblePurchaseRows}
          searchPlaceholder="거래처명/품목명/계정과목 검색..."
          toolbarExtra={<Button onClick={handleDownloadPurchase}>엑셀 다운</Button>}
          belowToolbar={
            <nav className="card-tabs">
              <button
                type="button"
                className={effectivePurchaseMonthFilter === 'all' ? 'active' : ''}
                onClick={() => setPurchaseMonthFilter('all')}
              >
                전체
              </button>
              {purchaseMonthGroups.map((g) => (
                <button
                  type="button"
                  key={g.month}
                  className={g.month === effectivePurchaseMonthFilter ? 'active' : ''}
                  onClick={() => setPurchaseMonthFilter(g.month)}
                >
                  {g.month}
                </button>
              ))}
            </nav>
          }
          footerCells={taxInvoiceFooterCells}
        />
      )}
    </div>
  )
}
