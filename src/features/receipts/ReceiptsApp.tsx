'use client'

import { useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
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
import { groupReceiptsByCard, parseReceiptRows, type ReceiptEntry } from './lib/parseReceipt'
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
import { Button } from './components/ui/button'
import { formatNumber } from './lib/format'

// 세금계산서(매출/매입) 표 하단 합계 행: 합계금액/공급가액/세액을 합산해 표시한다.
function taxInvoiceFooterCells(rows: TaxInvoiceRow[]): Record<string, ReactNode> {
  return {
    no: '합계',
    totalAmount: formatNumber(rows.reduce((sum, r) => sum + r.totalAmount, 0)),
    supplyAmount: formatNumber(rows.reduce((sum, r) => sum + r.supplyAmount, 0)),
    taxAmount: formatNumber(rows.reduce((sum, r) => sum + r.taxAmount, 0)),
  }
}

// 영수증 표 하단 합계 행: 공급가액/세액/합계를 합산해 표시한다(카드별로 스코프된 rows 기준).
function receiptFooterCells(rows: ReceiptRow[]): Record<string, ReactNode> {
  return {
    date: '합계',
    supplyAmount: formatNumber(rows.reduce((sum, r) => sum + r.supplyAmount, 0)),
    taxAmount: formatNumber(rows.reduce((sum, r) => sum + r.taxAmount, 0)),
    totalAmount: formatNumber(rows.reduce((sum, r) => sum + r.totalAmount, 0)),
  }
}

type MainTab = 'sales' | 'purchase' | 'receipt'

const COUNTERPARTY_LIST_ID = 'dl-counterparty-name'
const MERCHANT_LIST_ID = 'dl-merchant-name'

// localStorage에 남아있는 예전 스키마(필드 추가 전) 데이터에는 일부 필드가 undefined일 수 있어
// 방어적으로 걸러낸다.
function uniqueNonEmpty(values: (string | undefined | null)[]): string[] {
  return [...new Set(values.map((v) => (v ?? '').trim()).filter((v) => v !== ''))]
}

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
  function handleClearAllTaxInvoice(
    draft: TaxInvoiceRow[] | null,
    monthFilter: string,
    setDraft: (rows: TaxInvoiceRow[]) => void,
  ) {
    const rows = draft ?? []
    if (monthFilter === 'all') {
      if (rows.length === 0) return
      if (window.confirm(`${rows.length}건의 데이터를 모두 초기화하시겠습니까? 되돌릴 수 없습니다.`)) {
        setDraft([])
      }
      return
    }

    const monthRows = rows.filter((r) => r.writtenDate.slice(0, 7) === monthFilter)
    if (monthRows.length === 0) return
    if (window.confirm(`선택한 ${monthFilter} 월 데이터 ${monthRows.length}건만 초기화하시겠습니까?`)) {
      setDraft(renumber(rows.filter((r) => r.writtenDate.slice(0, 7) !== monthFilter)))
      return
    }
    if (
      window.confirm(`취소하셨습니다. 대신 전체 데이터(${rows.length}건)를 모두 초기화하시겠습니까? 되돌릴 수 없습니다.`)
    ) {
      setDraft([])
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
      }),
    [accountRules, salesAccountCodes, salesPaymentBasisOptions, salesGlobalIndices],
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
      }),
    [accountRules, purchaseAccountCodes, purchasePaymentBasisOptions, purchaseGlobalIndices],
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
      }),
    [draftActiveCardSheet, receiptAccountCodes, receiptDetailOptions, accountRules],
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
            onDeleteRow={(visibleIndex) => {
              const index = salesGlobalIndices[visibleIndex]
              if (index === undefined) return
              setSalesDraft((prev) => renumber((prev ?? []).filter((_, i) => i !== index)))
            }}
            onAddRow={() => {
              setSalesDraft((prev) => [...(prev ?? []), createBlankTaxInvoiceRow((prev ?? []).length + 1)])
              setSalesMonthFilter('all')
            }}
            onClearAll={() => handleClearAllTaxInvoice(salesDraft, effectiveSalesMonthFilter, setSalesDraft)}
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
            onDeleteRow={(visibleIndex) => {
              const index = purchaseGlobalIndices[visibleIndex]
              if (index === undefined) return
              setPurchaseDraft((prev) => renumber((prev ?? []).filter((_, i) => i !== index)))
            }}
            onAddRow={() => {
              setPurchaseDraft((prev) => [...(prev ?? []), createBlankTaxInvoiceRow((prev ?? []).length + 1)])
              setPurchaseMonthFilter('all')
            }}
            onClearAll={() => handleClearAllTaxInvoice(purchaseDraft, effectivePurchaseMonthFilter, setPurchaseDraft)}
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
            toolbarExtra={<Button onClick={handleDownloadReceipt}>엑셀 다운</Button>}
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
            onAddRow={() => {
              const last4 = draftActiveCardSheet?.last4
              if (!last4) return
              const blank: ReceiptRow = createBlankReceiptRow()
              setReceiptDraft((prev) => [...(prev ?? []), { last4, row: blank }])
            }}
            onClearAll={() => {
              const globalIndices = new Set(draftActiveCardSheet?.globalIndices ?? [])
              setReceiptDraft((prev) => (prev ?? []).filter((_, i) => !globalIndices.has(i)))
            }}
          />
        </Modal>
      )}
    </div>
  )
}
