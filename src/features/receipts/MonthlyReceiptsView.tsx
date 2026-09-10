'use client'

import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import './receipts.css'
import { Table } from './components/Table'
import type { Column } from './components/Table'
import { createReceiptColumns } from './components/receiptColumns'
import { groupReceiptsByCard } from './lib/parseReceipt'
import { usePersistentState } from './lib/storage'
import { downloadReceiptWorkbook } from './lib/exportWorkbook'
import { receiptFooterCells } from './lib/footerCells'
import { DEFAULT_CARD_MASTER, cardSheetName } from './data/cardMaster'
import type { CardMasterEntry } from './data/cardMaster'
import type { ReceiptRow } from './types/tables'
import { Button } from './components/ui/button'
import type { ReceiptCardRowDTO } from '@/app/receipts/actions'

interface MonthlyReceiptsViewProps {
  initialEntries: ReceiptCardRowDTO[]
}

type SearchCategory = 'all' | 'last4' | 'detail' | 'accountCode'

// 표에 보여줄 행: 원본 영수증 행에 카드 정보(카드번호/닉네임)를 합친 것.
type ReceiptRowView = ReceiptRow & { last4: string; cardLabel: string }

function cardLabelFor(last4: string, cardMaster: CardMasterEntry[]): string {
  const entry = cardMaster.find((e) => e.last4 === last4)
  return entry ? cardSheetName(entry) : last4
}

// 정리 화면에서 확정된(DB에 저장된) 영수증 데이터를 기간(귀속월 범위)+조건으로 조회하는 화면. 카드별
// 구분 없이 모든 카드의 영수증을 함께 보여준다. 편집은 /receipts의 영수증 모달에서만 한다.
export default function MonthlyReceiptsView({ initialEntries }: MonthlyReceiptsViewProps) {
  // 카드 닉네임(카드 마스터)은 여전히 이 브라우저의 localStorage에서 관리한다(별도 범위).
  const [cardMaster] = usePersistentState<CardMasterEntry[]>('cardMaster', DEFAULT_CARD_MASTER)

  const [startMonth, setStartMonth] = useState('')
  const [endMonth, setEndMonth] = useState('')
  const [category, setCategory] = useState<SearchCategory>('all')
  const [searchText, setSearchText] = useState('')

  // 조회 버튼을 눌러야만 반영되는 확정 조건 — 처음 화면 진입 시에는 아무 조건도 적용되지 않은
  // 상태(hasSearched === false)라 표를 비워둔다.
  const [hasSearched, setHasSearched] = useState(false)
  const [appliedRange, setAppliedRange] = useState<{ start: string; end: string }>({ start: '', end: '' })
  const [appliedSearch, setAppliedSearch] = useState<{ category: SearchCategory; text: string }>({
    category: 'all',
    text: '',
  })

  const filteredRows = useMemo<ReceiptRowView[]>(() => {
    if (!hasSearched) return []

    const q = appliedSearch.text.trim().toLowerCase()

    return initialEntries
      .filter((e) => {
        const month = e.row.date.slice(0, 7)
        if (appliedRange.start && month < appliedRange.start) return false
        if (appliedRange.end && month > appliedRange.end) return false
        return true
      })
      .filter((e) => {
        if (!q) return true
        const label = cardLabelFor(e.last4, cardMaster).toLowerCase()
        const matchesCard = e.last4.toLowerCase().includes(q) || label.includes(q)
        const matchesDetail = e.row.detail.toLowerCase().includes(q)
        const matchesAccountCode = e.row.accountCode.toLowerCase().includes(q)
        if (appliedSearch.category === 'last4') return matchesCard
        if (appliedSearch.category === 'detail') return matchesDetail
        if (appliedSearch.category === 'accountCode') return matchesAccountCode
        return matchesCard || matchesDetail || matchesAccountCode
      })
      .map((e) => ({ ...e.row, last4: e.last4, cardLabel: cardLabelFor(e.last4, cardMaster) }))
  }, [initialEntries, hasSearched, appliedRange, appliedSearch, cardMaster])

  const columns = useMemo<Column<ReceiptRowView>[]>(() => {
    const base = createReceiptColumns({ readOnly: true })
    const cardColumn: Column<ReceiptRowView> = {
      key: 'cardLabel',
      label: '카드번호',
      align: 'center',
      width: 110,
      render: (r) => r.cardLabel,
    }
    const dateIndex = base.findIndex((c) => c.key === 'date')
    const merged: Column<ReceiptRowView>[] = [...base]
    merged.splice(dateIndex + 1, 0, cardColumn)
    return merged
  }, [])

  function handleSearch() {
    setAppliedRange({ start: startMonth, end: endMonth })
    setAppliedSearch({ category, text: searchText })
    setHasSearched(true)
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
          정리 화면에서 확정된 영수증 데이터를 기간·조건별로 조회합니다(조회 전용). 카드별 구분 없이 모든 카드의
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
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">검색 조건</span>
          <div className="relative">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as SearchCategory)}
              className="w-32 appearance-none rounded-md border border-input bg-transparent py-1 pl-3 pr-8"
            >
              <option value="all">전체</option>
              <option value="last4">카드번호</option>
              <option value="detail">세부내역</option>
              <option value="accountCode">계정과목</option>
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
            엑셀 다운(전체)
          </Button>
        </div>
      </div>

      <Table
        columns={columns}
        rows={filteredRows}
        hideSearch
        emptyMessage={
          hasSearched ? '조회 결과가 없습니다.' : '기간과 조건을 설정한 후 조회 버튼을 눌러주세요.'
        }
        footerCells={receiptFooterCells}
      />
    </div>
  )
}
