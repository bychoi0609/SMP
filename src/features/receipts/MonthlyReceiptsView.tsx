'use client'

import { useMemo, useState } from 'react'
import './receipts.css'
import { Table } from './components/Table'
import { createReceiptColumns } from './components/receiptColumns'
import { groupReceiptsByCard } from './lib/parseReceipt'
import { usePersistentState } from './lib/storage'
import { downloadReceiptWorkbook } from './lib/exportWorkbook'
import { receiptFooterCells } from './lib/footerCells'
import { DEFAULT_CARD_MASTER } from './data/cardMaster'
import type { CardMasterEntry } from './data/cardMaster'
import { Button } from './components/ui/button'
import type { ReceiptCardRowDTO } from '@/app/receipts/actions'

interface MonthlyReceiptsViewProps {
  initialEntries: ReceiptCardRowDTO[]
}

// 정리 화면에서 확정된(DB에 저장된) 영수증 데이터를 기간(귀속월 범위)으로 조회하는 화면. 카드별
// 구분 없이 모든 카드의 영수증을 함께 보여준다. 편집은 /receipts의 영수증 모달에서만 한다.
export default function MonthlyReceiptsView({ initialEntries }: MonthlyReceiptsViewProps) {
  // 카드 닉네임(카드 마스터)은 여전히 이 브라우저의 localStorage에서 관리한다(별도 범위).
  const [cardMaster] = usePersistentState<CardMasterEntry[]>('cardMaster', DEFAULT_CARD_MASTER)

  const [startMonth, setStartMonth] = useState('')
  const [endMonth, setEndMonth] = useState('')
  const [appliedRange, setAppliedRange] = useState<{ start: string; end: string }>({ start: '', end: '' })

  const filteredRows = useMemo(
    () =>
      initialEntries
        .filter((e) => {
          const month = e.row.date.slice(0, 7)
          if (appliedRange.start && month < appliedRange.start) return false
          if (appliedRange.end && month > appliedRange.end) return false
          return true
        })
        .map((e) => e.row),
    [initialEntries, appliedRange],
  )

  const columns = useMemo(() => createReceiptColumns({ readOnly: true }), [])

  function handleSearch() {
    setAppliedRange({ start: startMonth, end: endMonth })
  }

  function handleDownload() {
    const sheets = groupReceiptsByCard(initialEntries, cardMaster).sheets
    downloadReceiptWorkbook(sheets).catch((e) =>
      window.alert(e instanceof Error ? e.message : '다운로드 중 오류가 발생했습니다.'),
    )
  }

  return (
    <div className="receipts-scope app">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">월별 영수증 데이터</h1>
        <p className="text-sm text-muted-foreground">
          정리 화면에서 확정된 영수증 데이터를 기간별로 조회합니다(조회 전용). 카드별 구분 없이 모든 카드의
          영수증을 함께 보여줍니다.
        </p>
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
        <Button onClick={handleSearch}>검색</Button>
      </div>

      <Table
        columns={columns}
        rows={filteredRows}
        searchPlaceholder="거래처명/현장명/계정과목 검색..."
        toolbarExtra={<Button onClick={handleDownload}>엑셀 다운(전체)</Button>}
        footerCells={receiptFooterCells}
      />
    </div>
  )
}
