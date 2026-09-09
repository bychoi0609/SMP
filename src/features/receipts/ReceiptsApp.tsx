'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { Lock, Unlock } from 'lucide-react'
import { cn } from '@/lib/utils'
import './receipts.css'
import { FileDropzone } from './components/FileDropzone'
import { ErrorBanner } from './components/ErrorBanner'
import { SheetPicker } from './components/SheetPicker'
import { Table } from './components/Table'
import { createTaxInvoiceColumns } from './components/taxInvoiceColumns'
import { createReceiptColumns } from './components/receiptColumns'
import { readWorkbookFromFile, type RawSheet, type RawWorkbook } from './lib/excelRead'
import { detectSheetKind } from './lib/detectKind'
import { detectDirectionFromFileName, parseTaxInvoiceRows } from './lib/parseTaxInvoice'
import { mergeTaxInvoiceRows } from './lib/mergeTaxInvoiceRows'
import { groupTaxInvoiceRowsByMonth } from './lib/groupTaxInvoiceByMonth'
import { groupReceiptsByMonth } from './lib/groupReceiptsByMonth'
import { groupReceiptsByCard, parseReceiptRows, type ReceiptEntry } from './lib/parseReceipt'
import { applyReceiptMapping, parseReceiptMappingSheet } from './lib/parseReceiptMapping'
import { DEFAULT_CARD_MASTER } from './data/cardMaster'
import type { ReceiptRow, TaxInvoiceRow } from './types/tables'
import { usePersistentState } from './lib/storage'
import { applyReceiptRowUpdate, applyTaxInvoiceRowUpdate, renumber } from './lib/applyRowUpdate'
import { applyAccountCodeAutofillBatch } from './lib/repeatTransaction'
import { createBlankReceiptRow, createBlankTaxInvoiceRow } from './lib/blankRows'
import {
  downloadPurchaseMonthWorkbook,
  downloadPurchaseWorkbook,
  downloadReceiptWorkbook,
  downloadSalesMonthWorkbook,
  downloadSalesWorkbook,
} from './lib/exportWorkbook'
import { parseBankTransactionRows } from './lib/parseBankTransaction'
import { matchTaxInvoicesWithBank, summarizeMatchDiff } from './lib/matchPayments'
import { CardMasterPanel } from './components/CardMasterPanel'
import { Modal } from './components/Modal'
import type { CardMasterEntry } from './data/cardMaster'
import { AccountRulePanel } from './components/AccountRulePanel'
import { DEFAULT_ACCOUNT_RULES, type AccountRuleEntry } from './data/accountRules'
import { applyAccountRulesToReceiptRows, applyAccountRulesToRows } from './lib/accountRules'
import { Button, buttonVariants } from './components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { uniqueNonEmpty } from './lib/format'
import { taxInvoiceFooterCells, receiptFooterCells } from './lib/footerCells'
import {
  confirmReceiptCardMonthAction,
  confirmTaxInvoiceMonthAction,
  getConfirmedReceiptMonthsAction,
  unconfirmReceiptCardMonthAction,
  unconfirmTaxInvoiceMonthAction,
  type ReceiptCategoryValue,
} from '@/app/receipts/actions'

type MainTab = 'sales' | 'purchase' | 'receipt'

const COUNTERPARTY_LIST_ID = 'dl-counterparty-name'
const MERCHANT_LIST_ID = 'dl-merchant-name'

export default function ReceiptsApp() {
  const [salesRows, setSalesRows] = usePersistentState<TaxInvoiceRow[]>('salesRows', [])
  const [purchaseRows, setPurchaseRows] = usePersistentState<TaxInvoiceRow[]>('purchaseRows', [])
  const [receiptEntries, setReceiptEntries] = usePersistentState<ReceiptEntry[]>('receiptEntries', [])
  const [cardMaster, setCardMaster] = usePersistentState<CardMasterEntry[]>('cardMaster', DEFAULT_CARD_MASTER)
  const [accountRules, setAccountRules] = usePersistentState<AccountRuleEntry[]>(
    'accountRules',
    DEFAULT_ACCOUNT_RULES,
  )

  const [notices, setNotices] = useState<string[]>([])
  const [pendingWorkbook, setPendingWorkbook] = useState<RawWorkbook | null>(null)
  const [openModalTab, setOpenModalTab] = useState<MainTab | null>(null)
  const [activeCardLast4, setActiveCardLast4] = useState<string | null>(null)
  // 세금계산서 월별 필터 UI 상태 — 세션 내 화면 표시용이라 localStorage에는 저장하지 않는다 ('all' = 전체).
  const [salesMonthFilter, setSalesMonthFilter] = useState<string>('all')
  const [purchaseMonthFilter, setPurchaseMonthFilter] = useState<string>('all')
  const [showCardMaster, setShowCardMaster] = useState(false)
  const [showAccountRules, setShowAccountRules] = useState(false)

  // 카테고리별 확정(귀속월) 상태 — 마운트 시 서버에서 불러오고, 확정/확정취소 후 다시 불러온다.
  // 확정된 달에 속한 행은 정리 화면에서 잠긴다("월별 세금계산서/영수증 데이터" 화면에 반영됨).
  const [salesConfirmedMonths, setSalesConfirmedMonths] = useState<Set<string>>(new Set())
  const [purchaseConfirmedMonths, setPurchaseConfirmedMonths] = useState<Set<string>>(new Set())
  const [receiptConfirmedMonths, setReceiptConfirmedMonths] = useState<Set<string>>(new Set())
  const [isConfirming, startConfirming] = useTransition()
  // 영수증 탭은 월 탭이 따로 없어(카드 탭만 있음), 확정할 월을 고르는 별도 선택 상태를 둔다.
  const [receiptConfirmMonth, setReceiptConfirmMonth] = useState('')

  function refreshConfirmedMonths(category: ReceiptCategoryValue) {
    getConfirmedReceiptMonthsAction(category).then((months) => {
      const set = new Set(months)
      if (category === 'SALES') setSalesConfirmedMonths(set)
      else if (category === 'PURCHASE') setPurchaseConfirmedMonths(set)
      else setReceiptConfirmedMonths(set)
    })
  }

  useEffect(() => {
    refreshConfirmedMonths('SALES')
    refreshConfirmedMonths('PURCHASE')
    refreshConfirmedMonths('RECEIPT')
  }, [])

  // 각 카테고리(매출/매입/영수증) 모달은 실제 상태를 바로 고치지 않고 임시 작업본(draft)에서 편집한다.
  // 모달을 닫을 때 열었을 당시 스냅샷(baseline)과 달라졌으면 저장 여부를 확인하고, "확인"을 눌러야
  // 실제 상태(setSalesRows 등)에 반영되어 localStorage에도 저장된다.
  const [salesDraft, setSalesDraft] = useState<TaxInvoiceRow[] | null>(null)
  const [purchaseDraft, setPurchaseDraft] = useState<TaxInvoiceRow[] | null>(null)
  const [receiptDraft, setReceiptDraft] = useState<ReceiptEntry[] | null>(null)
  const salesBaselineRef = useRef<TaxInvoiceRow[] | null>(null)
  const purchaseBaselineRef = useRef<TaxInvoiceRow[] | null>(null)
  const receiptBaselineRef = useRef<ReceiptEntry[] | null>(null)
  const prevOpenModalTabRef = useRef<MainTab | null>(null)
  // 영수증 모달 안 "엑셀" 드롭다운의 "엑셀 업로드" 메뉴에서 쓴다 — 법인카드(양식).xlsx처럼 시트명이
  // 카드 뒷자리 4개인, 현장명/내역을 사람이 채워넣은 파일을 매칭 전용으로 올리는 숨김 입력이다
  // (상단 FileDropzone의 원본 카드사 파일 업로드와는 별개의 기능).
  const receiptUploadInputRef = useRef<HTMLInputElement>(null)

  // openModalTab이 바뀐 시점(모달을 새로 열거나 닫을 때)에만 한 번, 그 카테고리의 draft/baseline을
  // 최신 실제 상태로 스냅샷한다. useEffect 대신 렌더 중 조건부 setState로 처리해 한 프레임 지연 없이 반영한다.
  if (prevOpenModalTabRef.current !== openModalTab) {
    prevOpenModalTabRef.current = openModalTab
    salesBaselineRef.current = openModalTab === 'sales' ? salesRows : null
    setSalesDraft(openModalTab === 'sales' ? salesRows : null)
    purchaseBaselineRef.current = openModalTab === 'purchase' ? purchaseRows : null
    setPurchaseDraft(openModalTab === 'purchase' ? purchaseRows : null)
    receiptBaselineRef.current = openModalTab === 'receipt' ? receiptEntries : null
    setReceiptDraft(openModalTab === 'receipt' ? receiptEntries : null)
  }

  // 모달을 닫거나 다른 카테고리 탭으로 전환하려 할 때 호출한다. 편집 중이던 draft가 열었을 때와
  // 달라졌으면 저장 여부를 확인하고, "확인"을 누른 경우에만 실제 상태에 반영한다.
  function requestSetOpenModalTab(next: MainTab | null) {
    const current = openModalTab
    if (current === null || current === next) {
      setOpenModalTab(next)
      return
    }

    let dirty = false
    if (current === 'sales') dirty = JSON.stringify(salesDraft) !== JSON.stringify(salesBaselineRef.current)
    if (current === 'purchase') dirty = JSON.stringify(purchaseDraft) !== JSON.stringify(purchaseBaselineRef.current)
    if (current === 'receipt') dirty = JSON.stringify(receiptDraft) !== JSON.stringify(receiptBaselineRef.current)

    if (dirty && window.confirm('변경사항을 저장하시겠습니까?')) {
      if (current === 'sales' && salesDraft) setSalesRows(salesDraft)
      if (current === 'purchase' && purchaseDraft) setPurchaseRows(purchaseDraft)
      if (current === 'receipt' && receiptDraft) setReceiptEntries(receiptDraft)
    }

    setOpenModalTab(next)
  }

  const receiptGrouping = useMemo(
    () => groupReceiptsByCard(receiptEntries, cardMaster),
    [receiptEntries, cardMaster],
  )

  // 영수증 모달이 열려 있는 동안에는 draft 기준으로 카드별 시트를 그룹핑해 화면에 보여준다.
  const draftReceiptGrouping = useMemo(
    () => groupReceiptsByCard(receiptDraft ?? [], cardMaster),
    [receiptDraft, cardMaster],
  )
  const draftActiveCardSheet =
    draftReceiptGrouping.sheets.find((s) => s.last4 === activeCardLast4) ?? draftReceiptGrouping.sheets[0]

  // 세금계산서 월별 필터 — draft 기준으로 월별 그룹을 만들고, 선택된 필터에 해당하는 행/전체 배열
  // 인덱스(globalIndices)를 계산한다. 'all'이면 전체 draft를 그대로 보여준다.
  const salesMonthGroups = useMemo(() => groupTaxInvoiceRowsByMonth(salesDraft ?? []), [salesDraft])
  const purchaseMonthGroups = useMemo(() => groupTaxInvoiceRowsByMonth(purchaseDraft ?? []), [purchaseDraft])

  // 선택된 월이 (초기화 등으로) 더 이상 존재하지 않으면 "전체"로 취급한다.
  const effectiveSalesMonthFilter =
    salesMonthFilter === 'all' || salesMonthGroups.some((g) => g.month === salesMonthFilter)
      ? salesMonthFilter
      : 'all'
  const effectivePurchaseMonthFilter =
    purchaseMonthFilter === 'all' || purchaseMonthGroups.some((g) => g.month === purchaseMonthFilter)
      ? purchaseMonthFilter
      : 'all'

  const { rows: visibleSalesRows, globalIndices: salesGlobalIndices } = useMemo(() => {
    const draft = salesDraft ?? []
    if (effectiveSalesMonthFilter === 'all') return { rows: draft, globalIndices: draft.map((_, i) => i) }
    const group = salesMonthGroups.find((g) => g.month === effectiveSalesMonthFilter)
    return { rows: group?.rows ?? [], globalIndices: group?.globalIndices ?? [] }
  }, [salesDraft, salesMonthGroups, effectiveSalesMonthFilter])

  const { rows: visiblePurchaseRows, globalIndices: purchaseGlobalIndices } = useMemo(() => {
    const draft = purchaseDraft ?? []
    if (effectivePurchaseMonthFilter === 'all') return { rows: draft, globalIndices: draft.map((_, i) => i) }
    const group = purchaseMonthGroups.find((g) => g.month === effectivePurchaseMonthFilter)
    return { rows: group?.rows ?? [], globalIndices: group?.globalIndices ?? [] }
  }, [purchaseDraft, purchaseMonthGroups, effectivePurchaseMonthFilter])

  // 확정된 달에 속한 draft 배열 인덱스(전역 인덱스) 집합 — "전체" 탭처럼 확정/미확정 달이 섞여 있어도
  // 행 단위로 잠글 수 있도록 한다.
  const lockedSalesGlobalIndices = useMemo(
    () =>
      new Set(
        salesMonthGroups.filter((g) => salesConfirmedMonths.has(g.month)).flatMap((g) => g.globalIndices),
      ),
    [salesMonthGroups, salesConfirmedMonths],
  )
  const lockedPurchaseGlobalIndices = useMemo(
    () =>
      new Set(
        purchaseMonthGroups.filter((g) => purchaseConfirmedMonths.has(g.month)).flatMap((g) => g.globalIndices),
      ),
    [purchaseMonthGroups, purchaseConfirmedMonths],
  )

  // 영수증은 카드 탭만 있고 월 탭이 없으므로, 확정용 월 목록/잠금 판정은 draft 전체(카드 무관)를
  // 기준으로 따로 계산한다.
  const receiptMonthGroups = useMemo(() => groupReceiptsByMonth(receiptDraft ?? []), [receiptDraft])
  const lockedReceiptGlobalIndices = useMemo(
    () =>
      new Set(
        receiptMonthGroups.filter((g) => receiptConfirmedMonths.has(g.month)).flatMap((g) => g.globalIndices),
      ),
    [receiptMonthGroups, receiptConfirmedMonths],
  )

  // 확정 대상 월 선택값이 (초기화 등으로) 더 이상 존재하지 않으면 첫 번째 달로 되돌린다.
  if (
    receiptMonthGroups.length > 0 &&
    !receiptMonthGroups.some((g) => g.month === receiptConfirmMonth)
  ) {
    setReceiptConfirmMonth(receiptMonthGroups[0].month)
  } else if (receiptMonthGroups.length === 0 && receiptConfirmMonth !== '') {
    setReceiptConfirmMonth('')
  }

  function handleConfirmSalesMonth() {
    if (effectiveSalesMonthFilter === 'all') return
    startConfirming(async () => {
      const result = await confirmTaxInvoiceMonthAction('SALES', effectiveSalesMonthFilter, visibleSalesRows)
      if (result.error) return addError(result.error)
      refreshConfirmedMonths('SALES')
    })
  }
  function handleUnconfirmSalesMonth() {
    if (effectiveSalesMonthFilter === 'all') return
    startConfirming(async () => {
      const result = await unconfirmTaxInvoiceMonthAction('SALES', effectiveSalesMonthFilter)
      if (result.error) return addError(result.error)
      refreshConfirmedMonths('SALES')
    })
  }
  function handleConfirmPurchaseMonth() {
    if (effectivePurchaseMonthFilter === 'all') return
    startConfirming(async () => {
      const result = await confirmTaxInvoiceMonthAction('PURCHASE', effectivePurchaseMonthFilter, visiblePurchaseRows)
      if (result.error) return addError(result.error)
      refreshConfirmedMonths('PURCHASE')
    })
  }
  function handleUnconfirmPurchaseMonth() {
    if (effectivePurchaseMonthFilter === 'all') return
    startConfirming(async () => {
      const result = await unconfirmTaxInvoiceMonthAction('PURCHASE', effectivePurchaseMonthFilter)
      if (result.error) return addError(result.error)
      refreshConfirmedMonths('PURCHASE')
    })
  }
  function handleConfirmReceiptMonth() {
    const group = receiptMonthGroups.find((g) => g.month === receiptConfirmMonth)
    if (!group) return
    startConfirming(async () => {
      const result = await confirmReceiptCardMonthAction(receiptConfirmMonth, group.entries)
      if (result.error) return addError(result.error)
      refreshConfirmedMonths('RECEIPT')
    })
  }
  function handleUnconfirmReceiptMonth() {
    if (!receiptConfirmMonth) return
    startConfirming(async () => {
      const result = await unconfirmReceiptCardMonthAction(receiptConfirmMonth)
      if (result.error) return addError(result.error)
      refreshConfirmedMonths('RECEIPT')
    })
  }

  const counterpartyNames = useMemo(
    () => uniqueNonEmpty([...salesRows, ...purchaseRows].map((r) => r.counterpartyName)),
    [salesRows, purchaseRows],
  )
  const merchantNames = useMemo(
    () => uniqueNonEmpty(receiptEntries.map((e) => e.row.merchantName)),
    [receiptEntries],
  )
  // 계정과목 자동완성 후보는 카테고리별로 분리한다 — 매출/매입/영수증이 서로 다른 계정과목을 쓰기 때문에
  // 다른 카테고리에서만 쓰인 계정과목이 섞여서 뜨면 오히려 방해가 된다. 규칙 목록도 이제 구분(매출/매입/영수증)이
  // 있으므로 같은 구분의 규칙만 후보에 포함한다.
  const salesRuleAccountCodes = useMemo(
    () => uniqueNonEmpty(accountRules.filter((r) => r.division === '매출').map((r) => r.accountName)),
    [accountRules],
  )
  const purchaseRuleAccountCodes = useMemo(
    () => uniqueNonEmpty(accountRules.filter((r) => r.division === '매입').map((r) => r.accountName)),
    [accountRules],
  )
  const receiptRuleAccountCodes = useMemo(
    () => uniqueNonEmpty(accountRules.filter((r) => r.division === '영수증').map((r) => r.accountName)),
    [accountRules],
  )
  const salesAccountCodes = useMemo(
    () => uniqueNonEmpty([...salesRows.map((r) => r.accountCode), ...salesRuleAccountCodes]),
    [salesRows, salesRuleAccountCodes],
  )
  const purchaseAccountCodes = useMemo(
    () => uniqueNonEmpty([...purchaseRows.map((r) => r.accountCode), ...purchaseRuleAccountCodes]),
    [purchaseRows, purchaseRuleAccountCodes],
  )
  const receiptAccountCodes = useMemo(
    () => uniqueNonEmpty([...receiptEntries.map((e) => e.row.accountCode), ...receiptRuleAccountCodes]),
    [receiptEntries, receiptRuleAccountCodes],
  )
  // 세부내역도 계정과목처럼 엑셀식 자동완성 입력이라 지금까지 쓰인 값을 후보로 보여준다.
  const receiptDetailOptions = useMemo(
    () => uniqueNonEmpty(receiptEntries.map((e) => e.row.detail)),
    [receiptEntries],
  )
  // 규칙 목록 관리 화면의 자동완성은 구분 구분 없이 지금까지 쓰인 모든 계정과목을 후보로 보여준다.
  const ruleListAccountCodes = useMemo(
    () =>
      uniqueNonEmpty([
        ...salesRows.map((r) => r.accountCode),
        ...purchaseRows.map((r) => r.accountCode),
        ...receiptEntries.map((e) => e.row.accountCode),
        ...accountRules.map((r) => r.accountName),
      ]),
    [salesRows, purchaseRows, receiptEntries, accountRules],
  )
  // 대금기준도 계정과목처럼 엑셀식 자동완성 입력이라 지금까지 쓰인 값을 후보로 보여준다(영수증에는 대금기준이 없음).
  const salesRulePaymentBasis = useMemo(
    () => uniqueNonEmpty(accountRules.filter((r) => r.division === '매출').map((r) => r.paymentBasisAccount)),
    [accountRules],
  )
  const purchaseRulePaymentBasis = useMemo(
    () => uniqueNonEmpty(accountRules.filter((r) => r.division === '매입').map((r) => r.paymentBasisAccount)),
    [accountRules],
  )
  const salesPaymentBasisOptions = useMemo(
    () => uniqueNonEmpty([...salesRows.map((r) => r.paymentBasisAccount), ...salesRulePaymentBasis]),
    [salesRows, salesRulePaymentBasis],
  )
  const purchasePaymentBasisOptions = useMemo(
    () => uniqueNonEmpty([...purchaseRows.map((r) => r.paymentBasisAccount), ...purchaseRulePaymentBasis]),
    [purchaseRows, purchaseRulePaymentBasis],
  )
  const ruleListPaymentBasisOptions = useMemo(
    () =>
      uniqueNonEmpty([
        ...salesRows.map((r) => r.paymentBasisAccount),
        ...purchaseRows.map((r) => r.paymentBasisAccount),
        ...accountRules.map((r) => r.paymentBasisAccount),
      ]),
    [salesRows, purchaseRows, accountRules],
  )

  // 경고 메세지는 "전체 초기화" 확인창과 동일하게 브라우저 네이티브 팝업(별도 창)으로 표시한다.
  function addError(message: string) {
    window.alert(message)
  }
  function addNotice(message: string) {
    setNotices((prev) => [...prev, message])
  }
  function dismissNotice(index: number) {
    setNotices((prev) => prev.filter((_, i) => i !== index))
  }

  // 세금계산서 "전체 초기화" — 월 필터가 "전체"면 기존처럼 한 번만 확인하고 전부 지운다. 특정 월이
  // 선택되어 있으면 먼저 "이번 달만 지울지" 확인하고, 취소하면 "전체를 지울지" 다시 확인한다
  // (실수로 전체 누적 데이터가 한 번에 날아가는 것을 방지).
  // 확정되어 잠긴 행(lockedGlobalIndices)은 항상 삭제 대상에서 제외한다.
  function handleClearAllTaxInvoice(
    draft: TaxInvoiceRow[] | null,
    monthFilter: string,
    setDraft: (rows: TaxInvoiceRow[]) => void,
    lockedGlobalIndices: Set<number>,
  ) {
    const rows = draft ?? []
    const allClearableCount = rows.length - lockedGlobalIndices.size

    if (monthFilter === 'all') {
      if (allClearableCount <= 0) {
        if (rows.length > 0) addError('확정된 데이터는 삭제할 수 없습니다. 먼저 확정을 취소해주세요.')
        return
      }
      const suffix = lockedGlobalIndices.size > 0 ? ` (확정된 ${lockedGlobalIndices.size}건은 제외됩니다.)` : ''
      if (window.confirm(`${allClearableCount}건의 데이터를 모두 초기화하시겠습니까? 되돌릴 수 없습니다.${suffix}`)) {
        setDraft(renumber(rows.filter((_, i) => lockedGlobalIndices.has(i))))
      }
      return
    }

    const monthIndices = rows.map((r, i) => (r.writtenDate.slice(0, 7) === monthFilter ? i : -1)).filter((i) => i >= 0)
    const clearableMonthIndices = monthIndices.filter((i) => !lockedGlobalIndices.has(i))
    if (clearableMonthIndices.length === 0) {
      if (monthIndices.length > 0) addError('확정된 데이터는 삭제할 수 없습니다. 먼저 확정을 취소해주세요.')
      return
    }
    if (window.confirm(`선택한 ${monthFilter} 월 데이터 ${clearableMonthIndices.length}건만 초기화하시겠습니까?`)) {
      const toRemove = new Set(clearableMonthIndices)
      setDraft(renumber(rows.filter((_, i) => !toRemove.has(i))))
      return
    }
    if (allClearableCount <= 0) return
    const suffix = lockedGlobalIndices.size > 0 ? ` (확정된 ${lockedGlobalIndices.size}건은 제외됩니다.)` : ''
    if (
      window.confirm(`취소하셨습니다. 대신 전체 데이터(${allClearableCount}건)를 모두 초기화하시겠습니까? 되돌릴 수 없습니다.${suffix}`)
    ) {
      setDraft(renumber(rows.filter((_, i) => lockedGlobalIndices.has(i))))
    }
  }

  // 세금계산서(매출/매입) 모달 안의 "엑셀 다운" 버튼 — 화면에 보이는(아직 저장 전일 수 있는) draft 기준으로
  // 내보낸다. 월 탭이 "전체"면 월별 시트로 나뉜 전체 데이터를, 특정 월이 선택되어 있으면 그 월만 단일
  // 시트로 내보낸다(전체 탭에서 다운로드하면 이미 전체가 나가므로 별도 버튼으로 나눌 필요가 없다).
  function handleDownloadSales() {
    if (effectiveSalesMonthFilter === 'all') {
      downloadSalesWorkbook(salesDraft ?? []).catch((e) =>
        addError(e instanceof Error ? e.message : '다운로드 중 오류가 발생했습니다.'),
      )
      return
    }
    downloadSalesMonthWorkbook(visibleSalesRows, effectiveSalesMonthFilter).catch((e) =>
      addError(e instanceof Error ? e.message : '다운로드 중 오류가 발생했습니다.'),
    )
  }
  function handleDownloadPurchase() {
    if (effectivePurchaseMonthFilter === 'all') {
      downloadPurchaseWorkbook(purchaseDraft ?? []).catch((e) =>
        addError(e instanceof Error ? e.message : '다운로드 중 오류가 발생했습니다.'),
      )
      return
    }
    downloadPurchaseMonthWorkbook(visiblePurchaseRows, effectivePurchaseMonthFilter).catch((e) =>
      addError(e instanceof Error ? e.message : '다운로드 중 오류가 발생했습니다.'),
    )
  }
  // 영수증 모달 안의 "엑셀 다운" 버튼 — 화면에 보이는(아직 저장 전일 수 있는) draft 기준으로 카드별 시트를
  // 모두 담아 내보낸다(현재 선택된 카드 탭과 무관하게 전체 카드 시트를 내보낸다).
  function handleDownloadReceipt() {
    downloadReceiptWorkbook(draftReceiptGrouping.sheets).catch((e) =>
      addError(e instanceof Error ? e.message : '다운로드 중 오류가 발생했습니다.'),
    )
  }

  // FR-5: 마스터 목록에 없는 카드번호를 발견 즉시 등록할 수 있게 한다 (이용자명은 나중에 채워도 됨).
  function registerCard(last4: string) {
    setCardMaster((prev) => (prev.some((e) => e.last4 === last4) ? prev : [...prev, { last4, name: '' }]))
    setShowCardMaster(true)
  }

  // 계정과목 규칙 패널에서 "적용"을 누르면, 이미 업로드되어 있지만 계정과목이 비어있는 행에 소급 적용한다.
  // 각 카테고리는 해당 구분(매출/매입/영수증)의 규칙만 적용한다. 규칙 목록 자체는 패널에서 수정할 때마다
  // setAccountRules로 바로 저장되며, 데이터 반영은 이 함수를 명시적으로 호출할 때만 일어난다.
  function applyAccountRulesToAllData() {
    setSalesRows((prev) => applyAccountRulesToRows(prev, accountRules, 'sales'))
    setPurchaseRows((prev) => applyAccountRulesToRows(prev, accountRules, 'purchase'))
    setReceiptEntries((prev) => {
      const rows = applyAccountRulesToReceiptRows(prev.map((e) => e.row), accountRules)
      return prev.map((e, i) => ({ ...e, row: rows[i] }))
    })
  }

  function processSheet(fileName: string, sheet: RawSheet) {
    const detected = detectSheetKind(sheet.rows)

    if (detected.kind === 'taxInvoice') {
      const direction = detectDirectionFromFileName(fileName)
      if (!direction) {
        addError(
          `"${fileName}": 파일명에서 매출/매입 여부를 판별할 수 없습니다. 파일명에 "매출" 또는 "매입"이 포함되어야 합니다.`,
        )
        return
      }
      if (direction === 'sales') {
        setSalesRows((prev) => {
          const parsed = parseTaxInvoiceRows(sheet.rows, detected.headerRowIndex, direction, prev.length + 1)
          const autofilled = applyAccountCodeAutofillBatch(parsed, prev, direction, accountRules)
          return mergeTaxInvoiceRows(prev, autofilled)
        })
      } else {
        setPurchaseRows((prev) => {
          const parsed = parseTaxInvoiceRows(sheet.rows, detected.headerRowIndex, direction, prev.length + 1)
          const autofilled = applyAccountCodeAutofillBatch(parsed, prev, direction, accountRules)
          return mergeTaxInvoiceRows(prev, autofilled)
        })
      }
      return
    }

    if (detected.kind === 'receipt') {
      setReceiptEntries((prev) => {
        const parsed = parseReceiptRows(sheet.rows, detected.headerRowIndex)
        const filledRows = applyAccountRulesToReceiptRows(parsed.map((e) => e.row), accountRules)
        return [...prev, ...parsed.map((e, i) => ({ ...e, row: filledRows[i] }))]
      })
      return
    }

    if (detected.kind === 'bankTransaction') {
      addError(`"${fileName}"은(는) 통장내역 파일입니다. 아래 "통장내역으로 결제일 채우기" 영역에 업로드해주세요.`)
      return
    }

    addError(
      `"${fileName}"의 형식을 인식할 수 없습니다. 지원되는 세금계산서(홈택스)/영수증(카드사) 원본 파일이 맞는지 확인해주세요.`,
    )
  }

  async function handleFiles(files: File[]) {
    for (const file of files) {
      let workbook: RawWorkbook
      try {
        workbook = await readWorkbookFromFile(file)
      } catch (e) {
        addError(e instanceof Error ? e.message : `"${file.name}" 파일을 읽는 중 오류가 발생했습니다.`)
        continue
      }

      if (workbook.sheets.length > 1) {
        setPendingWorkbook(workbook)
      } else {
        processSheet(workbook.fileName, workbook.sheets[0])
      }
    }
  }

  function confirmSheetSelection(selectedNames: string[]) {
    if (!pendingWorkbook) return
    for (const sheet of pendingWorkbook.sheets) {
      if (selectedNames.includes(sheet.name)) processSheet(pendingWorkbook.fileName, sheet)
    }
    setPendingWorkbook(null)
  }

  // FR-4: 통장내역은 FR-1 업로드와 별도의 영역에서 받아, 매출/매입 세금계산서의 결제일을 채운다.
  async function handleBankFiles(files: File[]) {
    for (const file of files) {
      let workbook: RawWorkbook
      try {
        workbook = await readWorkbookFromFile(file)
      } catch (e) {
        addError(e instanceof Error ? e.message : `"${file.name}" 파일을 읽는 중 오류가 발생했습니다.`)
        continue
      }

      const bankSheet = workbook.sheets.find((s) => detectSheetKind(s.rows).kind === 'bankTransaction')
      if (!bankSheet) {
        addError(`"${file.name}"에서 통장내역 형식을 찾을 수 없습니다. 통장내역조회 원본 파일이 맞는지 확인해주세요.`)
        continue
      }

      const { headerRowIndex } = detectSheetKind(bankSheet.rows)
      const bankTransactions = parseBankTransactionRows(bankSheet.rows, headerRowIndex)

      const nextSales = matchTaxInvoicesWithBank(salesRows, 'sales', bankTransactions)
      const nextPurchase = matchTaxInvoicesWithBank(purchaseRows, 'purchase', bankTransactions)
      const salesSummary = summarizeMatchDiff(salesRows, nextSales)
      const purchaseSummary = summarizeMatchDiff(purchaseRows, nextPurchase)

      setSalesRows(nextSales)
      setPurchaseRows(nextPurchase)

      const matched = salesSummary.matched + purchaseSummary.matched
      const ambiguous = salesSummary.ambiguous + purchaseSummary.ambiguous
      addNotice(
        `"${file.name}" 매칭 결과 — 결제일 자동 입력 ${matched}건, 확인 필요(애매한 매칭) ${ambiguous}건. 세금계산서 표의 강조된 결제일 셀을 확인해주세요.`,
      )
    }
  }

  // 영수증 모달의 "엑셀 업로드" — 법인카드(양식).xlsx처럼 시트명이 카드 뒷자리 4개이고 카드번호 컬럼이
  // 없는 파일을 올려, 날짜/거래처명/공급가액/세액/합계가 모두 일치하는 draft 행을 찾아 현장명/내역만
  // 채워 넣는다(다른 필드는 건드리지 않음). 일반 카드사 원본 업로드(handleFiles)와는 별개의 기능이다.
  async function handleReceiptMappingUpload(files: File[]) {
    let current = receiptDraft ?? receiptEntries
    for (const file of files) {
      let workbook: RawWorkbook
      try {
        workbook = await readWorkbookFromFile(file)
      } catch (e) {
        addError(e instanceof Error ? e.message : `"${file.name}" 파일을 읽는 중 오류가 발생했습니다.`)
        continue
      }

      const mappingRows = workbook.sheets.flatMap((sheet) => parseReceiptMappingSheet(sheet))
      if (mappingRows.length === 0) {
        addError(
          `"${file.name}"에서 매핑할 데이터를 찾을 수 없습니다. 시트명이 카드 뒷자리 4자리를 포함하고, "날짜/거래처명/공급가액/세액/합계/현장명/내역" 헤더가 있으며, 현장명 또는 내역이 채워져 있는지 확인해주세요.`,
        )
        continue
      }

      const result = applyReceiptMapping(current, mappingRows)
      current = result.entries
      addNotice(
        `"${file.name}" 매핑 결과 — 현장명/내역 자동 입력 ${result.matchedCount}건, 일치하는 행을 찾지 못함 ${result.unmatchedCount}건.`,
      )
    }
    setReceiptDraft(current)
  }

  const salesColumns = useMemo(
    () =>
      createTaxInvoiceColumns({
        onChange: (visibleIndex, patch) => {
          const index = salesGlobalIndices[visibleIndex]
          if (index === undefined) return
          setSalesDraft((prev) => (prev ? applyTaxInvoiceRowUpdate(prev, index, patch, 'sales', accountRules) : prev))
        },
        counterpartyNameListId: COUNTERPARTY_LIST_ID,
        accountCodeOptions: salesAccountCodes,
        accountCodeMinWidth: 130,
        paymentBasisOptions: salesPaymentBasisOptions,
        direction: 'sales',
        isRowLocked: (visibleIndex) => {
          const globalIndex = salesGlobalIndices[visibleIndex]
          return globalIndex !== undefined && lockedSalesGlobalIndices.has(globalIndex)
        },
      }),
    [accountRules, salesAccountCodes, salesPaymentBasisOptions, salesGlobalIndices, lockedSalesGlobalIndices],
  )
  const purchaseColumns = useMemo(
    () =>
      createTaxInvoiceColumns({
        onChange: (visibleIndex, patch) => {
          const index = purchaseGlobalIndices[visibleIndex]
          if (index === undefined) return
          setPurchaseDraft((prev) =>
            prev ? applyTaxInvoiceRowUpdate(prev, index, patch, 'purchase', accountRules) : prev,
          )
        },
        counterpartyNameListId: COUNTERPARTY_LIST_ID,
        accountCodeOptions: purchaseAccountCodes,
        accountCodeMinWidth: 130,
        paymentBasisOptions: purchasePaymentBasisOptions,
        direction: 'purchase',
        isRowLocked: (visibleIndex) => {
          const globalIndex = purchaseGlobalIndices[visibleIndex]
          return globalIndex !== undefined && lockedPurchaseGlobalIndices.has(globalIndex)
        },
      }),
    [accountRules, purchaseAccountCodes, purchasePaymentBasisOptions, purchaseGlobalIndices, lockedPurchaseGlobalIndices],
  )
  const receiptCols = useMemo(
    () =>
      createReceiptColumns({
        onChange: (displayIndex, patch) => {
          const globalIndex = draftActiveCardSheet?.globalIndices[displayIndex]
          if (globalIndex === undefined) return
          setReceiptDraft((prev) =>
            (prev ?? []).map((entry, i) =>
              i === globalIndex ? { ...entry, row: applyReceiptRowUpdate(entry.row, patch, accountRules) } : entry,
            ),
          )
        },
        merchantNameListId: MERCHANT_LIST_ID,
        accountCodeOptions: receiptAccountCodes,
        detailOptions: receiptDetailOptions,
        isRowLocked: (displayIndex) => {
          const globalIndex = draftActiveCardSheet?.globalIndices[displayIndex]
          return globalIndex !== undefined && lockedReceiptGlobalIndices.has(globalIndex)
        },
      }),
    [draftActiveCardSheet, receiptAccountCodes, receiptDetailOptions, accountRules, lockedReceiptGlobalIndices],
  )

  return (
    <div className="receipts-scope app">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">영수증·세금계산서 정리</h1>
        <p className="text-sm text-muted-foreground">
          홈택스 세금계산서, 카드사 영수증, 통장내역 엑셀 파일을 업로드해 정리하고 다시 엑셀로 내려받습니다. 이
          브라우저에만 저장되며(다른 기기와 공유되지 않음), 서버에는 전송되지 않습니다.
        </p>
      </div>

      <datalist id={COUNTERPARTY_LIST_ID}>
        {counterpartyNames.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <datalist id={MERCHANT_LIST_ID}>
        {merchantNames.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <FileDropzone onFiles={handleFiles} />

      <section className="bank-upload">
        <h2>결제일 자동매핑</h2>
        <FileDropzone
          onFiles={handleBankFiles}
          label={'통장내역조회 원본 엑셀(.xlsx) 파일을 여기로 드래그하세요.\n매출은 입금, 매입은 출금 내역과 자동 매칭됩니다.'}
          buttonLabel="파일 선택"
          compact
        />
      </section>

      <ErrorBanner messages={notices} onDismiss={dismissNotice} variant="info" />

      {pendingWorkbook && (
        <SheetPicker
          workbook={pendingWorkbook}
          onConfirm={confirmSheetSelection}
          onCancel={() => setPendingWorkbook(null)}
        />
      )}

      {receiptGrouping.unregisteredLast4.length > 0 && (
        <div className="warning-banner">
          카드 마스터 목록에 없는 카드번호가 발견되었습니다:{' '}
          {receiptGrouping.unregisteredLast4.map((last4) => (
            <span key={last4}>
              {last4}
              <Button
                variant="pill"
                size="xs"
                className="ml-2 border-warning-foreground/30 text-warning-foreground hover:bg-warning-foreground/10"
                onClick={() => registerCard(last4)}
              >
                등록
              </Button>{' '}
            </span>
          ))}
        </div>
      )}

      {showCardMaster && (
        <CardMasterPanel cardMaster={cardMaster} onChange={setCardMaster} onClose={() => setShowCardMaster(false)} />
      )}

      {showAccountRules && (
        <AccountRulePanel
          rules={accountRules}
          onChange={setAccountRules}
          onApply={applyAccountRulesToAllData}
          onClose={() => setShowAccountRules(false)}
          accountCodeOptions={ruleListAccountCodes}
          paymentBasisOptions={ruleListPaymentBasisOptions}
        />
      )}

      <div className="tabs-row">
        <nav className="main-tabs">
          <button
            type="button"
            className={openModalTab === 'sales' ? 'active' : ''}
            onClick={() => requestSetOpenModalTab(openModalTab === 'sales' ? null : 'sales')}
          >
            세금계산서(매출) {salesRows.length > 0 && `(${salesRows.length})`}
          </button>
          <button
            type="button"
            className={openModalTab === 'purchase' ? 'active' : ''}
            onClick={() => requestSetOpenModalTab(openModalTab === 'purchase' ? null : 'purchase')}
          >
            세금계산서(매입) {purchaseRows.length > 0 && `(${purchaseRows.length})`}
          </button>
          <button
            type="button"
            className={openModalTab === 'receipt' ? 'active' : ''}
            onClick={() => requestSetOpenModalTab(openModalTab === 'receipt' ? null : 'receipt')}
          >
            영수증
          </button>
        </nav>
        <div className="tabs-row__actions">
          <Button className="my-1.5 flex-shrink-0" onClick={() => setShowCardMaster((prev) => !prev)}>
            카드 관리
          </Button>
          <Button className="my-1.5 flex-shrink-0" onClick={() => setShowAccountRules((prev) => !prev)}>
            계정과목 규칙
          </Button>
        </div>
      </div>

      {openModalTab === 'sales' && (
        <Modal title="세금계산서(매출)" onClose={() => requestSetOpenModalTab(null)}>
          <Table
            columns={salesColumns}
            rows={visibleSalesRows}
            searchPlaceholder="거래처명/품목명/계정과목 검색..."
            toolbarExtra={
              <>
                <Button onClick={handleDownloadSales}>엑셀 다운</Button>
                {effectiveSalesMonthFilter !== 'all' && (
                  <>
                    <span
                      className={cn(
                        'rounded-full border px-2 py-0.5 text-xs font-medium',
                        salesConfirmedMonths.has(effectiveSalesMonthFilter)
                          ? 'border-transparent bg-secondary text-secondary-foreground'
                          : 'border-border text-muted-foreground',
                      )}
                    >
                      {salesConfirmedMonths.has(effectiveSalesMonthFilter) ? '확정됨' : '작업중'}
                    </span>
                    {salesConfirmedMonths.has(effectiveSalesMonthFilter) ? (
                      <Button variant="outline" disabled={isConfirming} onClick={handleUnconfirmSalesMonth}>
                        <Unlock className="size-3.5" /> {isConfirming ? '처리 중...' : '확정 취소'}
                      </Button>
                    ) : (
                      <Button disabled={isConfirming} onClick={handleConfirmSalesMonth}>
                        <Lock className="size-3.5" /> {isConfirming ? '처리 중...' : '확정'}
                      </Button>
                    )}
                  </>
                )}
              </>
            }
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
                    {salesConfirmedMonths.has(g.month) && ' 🔒'}
                  </button>
                ))}
              </nav>
            }
            onDeleteRow={(visibleIndex) => {
              const index = salesGlobalIndices[visibleIndex]
              if (index === undefined) return
              setSalesDraft((prev) => renumber((prev ?? []).filter((_, i) => i !== index)))
            }}
            isRowDisabled={(visibleIndex) => {
              const index = salesGlobalIndices[visibleIndex]
              return index !== undefined && lockedSalesGlobalIndices.has(index)
            }}
            onAddRow={() => {
              setSalesDraft((prev) => [...(prev ?? []), createBlankTaxInvoiceRow((prev ?? []).length + 1)])
              setSalesMonthFilter('all')
            }}
            onClearAll={() =>
              handleClearAllTaxInvoice(salesDraft, effectiveSalesMonthFilter, setSalesDraft, lockedSalesGlobalIndices)
            }
            skipClearAllConfirm
            footerCells={taxInvoiceFooterCells}
          />
        </Modal>
      )}
      {openModalTab === 'purchase' && (
        <Modal title="세금계산서(매입)" onClose={() => requestSetOpenModalTab(null)}>
          <Table
            columns={purchaseColumns}
            rows={visiblePurchaseRows}
            searchPlaceholder="거래처명/품목명/계정과목 검색..."
            toolbarExtra={
              <>
                <Button onClick={handleDownloadPurchase}>엑셀 다운</Button>
                {effectivePurchaseMonthFilter !== 'all' && (
                  <>
                    <span
                      className={cn(
                        'rounded-full border px-2 py-0.5 text-xs font-medium',
                        purchaseConfirmedMonths.has(effectivePurchaseMonthFilter)
                          ? 'border-transparent bg-secondary text-secondary-foreground'
                          : 'border-border text-muted-foreground',
                      )}
                    >
                      {purchaseConfirmedMonths.has(effectivePurchaseMonthFilter) ? '확정됨' : '작업중'}
                    </span>
                    {purchaseConfirmedMonths.has(effectivePurchaseMonthFilter) ? (
                      <Button variant="outline" disabled={isConfirming} onClick={handleUnconfirmPurchaseMonth}>
                        <Unlock className="size-3.5" /> {isConfirming ? '처리 중...' : '확정 취소'}
                      </Button>
                    ) : (
                      <Button disabled={isConfirming} onClick={handleConfirmPurchaseMonth}>
                        <Lock className="size-3.5" /> {isConfirming ? '처리 중...' : '확정'}
                      </Button>
                    )}
                  </>
                )}
              </>
            }
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
                    {purchaseConfirmedMonths.has(g.month) && ' 🔒'}
                  </button>
                ))}
              </nav>
            }
            onDeleteRow={(visibleIndex) => {
              const index = purchaseGlobalIndices[visibleIndex]
              if (index === undefined) return
              setPurchaseDraft((prev) => renumber((prev ?? []).filter((_, i) => i !== index)))
            }}
            isRowDisabled={(visibleIndex) => {
              const index = purchaseGlobalIndices[visibleIndex]
              return index !== undefined && lockedPurchaseGlobalIndices.has(index)
            }}
            onAddRow={() => {
              setPurchaseDraft((prev) => [...(prev ?? []), createBlankTaxInvoiceRow((prev ?? []).length + 1)])
              setPurchaseMonthFilter('all')
            }}
            onClearAll={() =>
              handleClearAllTaxInvoice(
                purchaseDraft,
                effectivePurchaseMonthFilter,
                setPurchaseDraft,
                lockedPurchaseGlobalIndices,
              )
            }
            skipClearAllConfirm
            footerCells={taxInvoiceFooterCells}
          />
        </Modal>
      )}

      {openModalTab === 'receipt' && (
        <Modal title="영수증" onClose={() => requestSetOpenModalTab(null)}>
          <Table
            columns={receiptCols}
            rows={draftActiveCardSheet?.rows ?? []}
            searchPlaceholder="거래처명/계정과목 검색..."
            footerCells={receiptFooterCells}
            toolbarExtra={
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger className={buttonVariants({ variant: 'default', size: 'default' })}>
                    엑셀
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleDownloadReceipt}>엑셀 다운</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => receiptUploadInputRef.current?.click()}>
                      엑셀 업로드
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <input
                  ref={receiptUploadInputRef}
                  type="file"
                  accept=".xls,.xlsx"
                  multiple
                  hidden
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0)
                      handleReceiptMappingUpload(Array.from(e.target.files))
                    e.target.value = ''
                  }}
                />
                {receiptMonthGroups.length > 0 && (
                  <>
                    <select
                      className="rounded-md border border-input bg-transparent px-1.5 py-[2px] text-sm text-foreground"
                      value={receiptConfirmMonth}
                      onChange={(e) => setReceiptConfirmMonth(e.target.value)}
                    >
                      {receiptMonthGroups.map((g) => (
                        <option key={g.month} value={g.month}>
                          {g.month}
                          {receiptConfirmedMonths.has(g.month) ? ' (확정됨)' : ''}
                        </option>
                      ))}
                    </select>
                    <span
                      className={cn(
                        'rounded-full border px-2 py-0.5 text-xs font-medium',
                        receiptConfirmedMonths.has(receiptConfirmMonth)
                          ? 'border-transparent bg-secondary text-secondary-foreground'
                          : 'border-border text-muted-foreground',
                      )}
                    >
                      {receiptConfirmedMonths.has(receiptConfirmMonth) ? '확정됨' : '작업중'}
                    </span>
                    {receiptConfirmedMonths.has(receiptConfirmMonth) ? (
                      <Button variant="outline" disabled={isConfirming} onClick={handleUnconfirmReceiptMonth}>
                        <Unlock className="size-3.5" /> {isConfirming ? '처리 중...' : '확정 취소'}
                      </Button>
                    ) : (
                      <Button disabled={isConfirming} onClick={handleConfirmReceiptMonth}>
                        <Lock className="size-3.5" /> {isConfirming ? '처리 중...' : '확정'}
                      </Button>
                    )}
                  </>
                )}
              </>
            }
            belowToolbar={
              <nav className="card-tabs">
                {draftReceiptGrouping.sheets.map((sheet) => (
                  <button
                    type="button"
                    key={sheet.last4}
                    className={sheet.last4 === draftActiveCardSheet?.last4 ? 'active' : ''}
                    onClick={() => setActiveCardLast4(sheet.last4)}
                  >
                    {sheet.name}
                  </button>
                ))}
              </nav>
            }
            onDeleteRow={(displayIndex) => {
              const globalIndex = draftActiveCardSheet?.globalIndices[displayIndex]
              if (globalIndex === undefined) return
              setReceiptDraft((prev) => (prev ?? []).filter((_, i) => i !== globalIndex))
            }}
            isRowDisabled={(displayIndex) => {
              const globalIndex = draftActiveCardSheet?.globalIndices[displayIndex]
              return globalIndex !== undefined && lockedReceiptGlobalIndices.has(globalIndex)
            }}
            onAddRow={() => {
              const last4 = draftActiveCardSheet?.last4
              if (!last4) return
              const blank: ReceiptRow = createBlankReceiptRow()
              setReceiptDraft((prev) => [...(prev ?? []), { last4, row: blank }])
            }}
            onClearAll={() => {
              const globalIndices = new Set(draftActiveCardSheet?.globalIndices ?? [])
              setReceiptDraft((prev) =>
                (prev ?? []).filter((_, i) => !globalIndices.has(i) || lockedReceiptGlobalIndices.has(i)),
              )
            }}
          />
        </Modal>
      )}
    </div>
  )
}
