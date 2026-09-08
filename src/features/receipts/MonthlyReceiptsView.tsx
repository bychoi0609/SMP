'use client'

import { useMemo, useState } from 'react'
import './receipts.css'
import { Table } from './components/Table'
import { createReceiptColumns } from './components/receiptColumns'
import { groupReceiptsByMonth } from './lib/groupReceiptsByMonth'
import { groupReceiptsByCard, type ReceiptEntry } from './lib/parseReceipt'
import { usePersistentState } from './lib/storage'
import { downloadReceiptWorkbook } from './lib/exportWorkbook'
import { receiptFooterCells } from './lib/footerCells'
import { DEFAULT_CARD_MASTER } from './data/cardMaster'
import type { CardMasterEntry } from './data/cardMaster'
import { Button } from './components/ui/button'

// 카드별이 아니라 저장된 영수증 전체를 월별로 또는 한 번에 보여주는 조회 전용 화면.
// 편집은 /receipts의 영수증 모달에서만 한다.
export default function MonthlyReceiptsView() {
  const [receiptEntries] = usePersistentState<ReceiptEntry[]>('receiptEntries', [])
  const [cardMaster] = usePersistentState<CardMasterEntry[]>('cardMaster', DEFAULT_CARD_MASTER)

  const [monthFilter, setMonthFilter] = useState('all')

  const monthGroups = useMemo(() => groupReceiptsByMonth(receiptEntries), [receiptEntries])
  const effectiveMonthFilter =
    monthFilter === 'all' || monthGroups.some((g) => g.month === monthFilter) ? monthFilter : 'all'

  const visibleRows = useMemo(() => {
    if (effectiveMonthFilter === 'all') return receiptEntries.map((e) => e.row)
    return (monthGroups.find((g) => g.month === effectiveMonthFilter)?.entries ?? []).map((e) => e.row)
  }, [receiptEntries, monthGroups, effectiveMonthFilter])

  const columns = useMemo(() => createReceiptColumns({ readOnly: true }), [])

  function handleDownload() {
    const sheets = groupReceiptsByCard(receiptEntries, cardMaster).sheets
    downloadReceiptWorkbook(sheets).catch((e) =>
      window.alert(e instanceof Error ? e.message : '다운로드 중 오류가 발생했습니다.'),
    )
  }

  return (
    <div className="receipts-scope app">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">월별 영수증 데이터</h1>
        <p className="text-sm text-muted-foreground">
          확정된 영수증 데이터를 월별로, 또는 전체를 한 번에 조회합니다(조회 전용). 카드별 구분 없이 모든 카드의
          영수증을 함께 보여줍니다.
        </p>
      </div>

      <Table
        columns={columns}
        rows={visibleRows}
        searchPlaceholder="거래처명/현장명/계정과목 검색..."
        toolbarExtra={<Button onClick={handleDownload}>엑셀 다운(전체)</Button>}
        belowToolbar={
          <nav className="card-tabs">
            <button
              type="button"
              className={effectiveMonthFilter === 'all' ? 'active' : ''}
              onClick={() => setMonthFilter('all')}
            >
              전체
            </button>
            {monthGroups.map((g) => (
              <button
                type="button"
                key={g.month}
                className={g.month === effectiveMonthFilter ? 'active' : ''}
                onClick={() => setMonthFilter(g.month)}
              >
                {g.month}
              </button>
            ))}
          </nav>
        }
        footerCells={receiptFooterCells}
      />
    </div>
  )
}
