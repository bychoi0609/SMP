import ExcelJS from 'exceljs'
import type { TaxInvoiceRow } from '../types/tables'
import type { ReceiptSheet } from './parseReceipt'

// 다운로드 양식은 samples/세금계산서,계산서(출력양식).xlsx 를 그대로 따른다 —
// 제목 행/회사명/병합 헤더/글꼴·색상·테두리·정렬/숫자·날짜 서식/합계(SUM) 행/열 너비까지 실제 사용 파일과 동일하게 맞춘다.
// (xlsx/SheetJS 무료판은 셀 스타일을 쓸 수 없어 — 파싱(excelRead.ts)은 계속 xlsx를 쓰되,
// 다운로드 생성은 스타일 저장을 지원하는 exceljs를 사용한다.)
const COMPANY_NAME = '쏠라크리닉'
const FONT: Partial<ExcelJS.Font> = { name: '굴림', size: 10 }
const AMOUNT_FORMAT = '###,##0'
const DATE_FORMAT = 'mm-dd-yy'

// 매출/매입/영수증 시트 모두 행 높이·열 너비·글꼴 크기를 동일하게 맞춘다 — 시트별로 원본 템플릿 값이
// 조금씩 달랐던 것(제목 24.9/25.75, 헤더 27.75/28.5, 데이터 18.9/17.6)을 하나로 통일.
// 제목·헤더 행은 25, 데이터·합계(푸터) 행은 17.6으로 통일한다.
const ROW_HEIGHTS = { title: 25, header: 25, data: 17.6, footer: 17.6 }

// exceljs 기본값(sheetFormatPr의 x14ac:dyDescent)이 55라는 비정상적인 값으로 하드코딩되어 있다
// (정상 범위는 0~1 사이 소수, 실제 엑셀 파일은 보통 0.25~0.3) — 시트 생성 직후 정상 값으로 덮어쓴다.
const SHEET_DY_DESCENT = 0.25

// exceljs는 <sheetViews>를 전혀 쓰지 않는다. Windows 디스플레이 배율이 100%가 아닌 환경(예: 200%)에서
// 엑셀이 이걸 확대/축소 배율 불명 상태로 취급해 행 높이를 실제 지정값의 절반 정도로 잘못 계산해서 보여주는
// 문제가 실측으로 확인됨 — zoomScale을 명시하면 해결된다.
const SHEET_VIEW: Partial<ExcelJS.WorksheetView> = { zoomScale: 100, zoomScaleNormal: 100, state: 'normal' }

// 매출/매입/영수증에서 의미가 같은 컬럼(작성일자↔날짜, 상호↔거래처명 등)은 같은 너비를 쓴다.
const WIDTH_NO = 5
const WIDTH_DATE = 11.84
const WIDTH_BIZNO = 15
const WIDTH_NAME = 29
const WIDTH_TOTAL = 15
const WIDTH_SUPPLY = 14.3
const WIDTH_TAX = 13.15
const WIDTH_ITEM = 60
const WIDTH_ISSUETYPE = 5
const WIDTH_TAXTYPE = 8
const WIDTH_ACCOUNT = 11.5
const WIDTH_PAYBASIS = 11
const WIDTH_PAYDATE = 14
const WIDTH_PROJECT = 23.7
const WIDTH_SITECODE = 3.38
const WIDTH_NOTE = 11.38
const WIDTH_DETAIL = 11

// 영수증 시트 전용 너비 — 세금계산서(매출/매입)는 실제 업로드 템플릿과 열 너비가 정확히 일치해야 해서
// 위 공용 WIDTH_* 상수를 그대로 쓰지만, 영수증 시트는 그런 고정 템플릿이 없어 현장명/내역 두 컬럼이
// 늘어난 만큼 전체 가로폭이 커지지 않도록 컬럼별 실제 글자 길이에 맞춰 자체 너비를 따로 둔다.
const RECEIPT_WIDTH_DATE = 11.84
const RECEIPT_WIDTH_NAME = 20
const RECEIPT_WIDTH_SUPPLY = 12
const RECEIPT_WIDTH_TAX = 11
const RECEIPT_WIDTH_TOTAL = 12
const RECEIPT_WIDTH_SITENAME = 12
const RECEIPT_WIDTH_DESCRIPTION = 10
const RECEIPT_WIDTH_ACCOUNT = 10
const RECEIPT_WIDTH_SITECODE = 3.38
const RECEIPT_WIDTH_TAXTYPE = 7
const RECEIPT_WIDTH_DETAIL = 9

// exceljs의 타입 정의(Color)에는 argb/theme만 있지만 실제로는 indexed/tint도 지원한다
// (템플릿 파일을 exceljs로 직접 읽어 확인함) — 타입 정의 누락이라 여기서만 느슨하게 캐스팅한다.
type LooseColor = { indexed?: number; theme?: number; tint?: number; argb?: string }
const HEADER_FILL_PLAIN = { type: 'pattern', pattern: 'solid', fgColor: { indexed: 22 } as LooseColor } as ExcelJS.Fill
const HEADER_FILL_ACCENT = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { theme: 8, tint: 0.7999816888943144 } as LooseColor,
} as ExcelJS.Fill
const THIN_BORDER_AUTO = {
  top: { style: 'thin', color: { indexed: 64 } as LooseColor },
  bottom: { style: 'thin', color: { indexed: 64 } as LooseColor },
  left: { style: 'thin', color: { indexed: 64 } as LooseColor },
  right: { style: 'thin', color: { indexed: 64 } as LooseColor },
} as Partial<ExcelJS.Borders>
const THIN_BORDER_DATA = {
  top: { style: 'thin', color: { indexed: 8 } as LooseColor },
  bottom: { style: 'thin', color: { indexed: 8 } as LooseColor },
  left: { style: 'thin', color: { indexed: 8 } as LooseColor },
  right: { style: 'thin', color: { indexed: 8 } as LooseColor },
} as Partial<ExcelJS.Borders>
// 헤더 행에서 1~8열(번호~품목명)은 옅은 배경, 9열(유형)부터는 강조 배경 — 템플릿과 동일한 구간.
const ACCENT_ZONE_START_COL = 9

interface MonthGroup {
  year: string
  month: string // "07" 형태, 작성일자를 알 수 없는 행은 ''
  rows: TaxInvoiceRow[]
}

// 작성일자(YYYY-MM-DD) 기준 월별로 묶는다 — 실제 사용 양식 파일이 월별 시트(매출세금계산서(07월) 등)로
// 관리되기 때문. 작성일자를 알 수 없는 행은 별도 그룹으로 모아 맨 뒤에 배치한다.
function groupTaxInvoiceRowsByMonth(rows: TaxInvoiceRow[]): MonthGroup[] {
  const buckets = new Map<string, TaxInvoiceRow[]>()
  for (const r of rows) {
    const m = /^(\d{4})-(\d{2})/.exec(r.writtenDate)
    const key = m ? `${m[1]}-${m[2]}` : ''
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key)!.push(r)
  }
  const keys = [...buckets.keys()].sort((a, b) => {
    if (a === '') return 1
    if (b === '') return -1
    return a < b ? -1 : a > b ? 1 : 0
  })
  return keys.map((key) => {
    const [year, month] = key ? key.split('-') : ['', '']
    return { year, month, rows: buckets.get(key)! }
  })
}

// "YYYY-MM-DD" 문자열을 로컬 타임존 기준 Date로 변환한다(new Date("YYYY-MM-DD")의 UTC 파싱으로 인한
// 날짜 밀림을 방지). 결제일이 비어있으면 null.
function parseDateOnlyToDate(dateStr: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

interface ColumnSpec<T> {
  header: string
  width: number
  align?: 'left' | 'center' | 'right'
  numFmt?: string
  wrapText?: boolean
  value: (r: T, index: number) => string | number | Date | null
}

const SALES_COLUMNS: ColumnSpec<TaxInvoiceRow>[] = [
  { header: '번호', width: WIDTH_NO, align: 'center', value: (_r, i) => i + 1 },
  { header: '작성일자', width: WIDTH_DATE, align: 'center', value: (r) => r.writtenDate },
  { header: '공급받는자\n사업자등록번호', width: WIDTH_BIZNO, align: 'center', wrapText: true, value: (r) => r.counterpartyBizNo },
  { header: '상호', width: WIDTH_NAME, value: (r) => r.counterpartyName },
  { header: '합계금액', width: WIDTH_TOTAL, align: 'right', numFmt: AMOUNT_FORMAT, value: (r) => r.totalAmount },
  { header: '공급가액', width: WIDTH_SUPPLY, align: 'right', numFmt: AMOUNT_FORMAT, value: (r) => r.supplyAmount },
  { header: '세액', width: WIDTH_TAX, align: 'right', numFmt: AMOUNT_FORMAT, value: (r) => r.taxAmount },
  { header: '품목명', width: WIDTH_ITEM, value: (r) => r.itemName },
  { header: '유형', width: WIDTH_ISSUETYPE, align: 'center', value: (r) => r.issueType },
  { header: '유형', width: WIDTH_TAXTYPE, align: 'center', value: (r) => r.taxType },
  { header: '전표처리', width: WIDTH_ACCOUNT, align: 'center', value: (r) => r.accountCode },
  { header: '전표처리', width: WIDTH_PAYBASIS, align: 'center', value: (r) => r.paymentBasisAccount },
  { header: '결제일', width: WIDTH_PAYDATE, align: 'center', numFmt: DATE_FORMAT, value: (r) => parseDateOnlyToDate(r.paymentDate) },
  { header: '프로젝트', width: WIDTH_PROJECT, align: 'center', value: (r) => r.project },
]
// 유형(9,10열)과 전표처리(11,12열) 헤더는 두 칸씩 병합.
const SALES_HEADER_MERGES: [number, number][] = [
  [9, 10],
  [11, 12],
]
const SALES_AMOUNT_COLS = [5, 6, 7] // 합계금액/공급가액/세액 (1-indexed)

const PURCHASE_COLUMNS: ColumnSpec<TaxInvoiceRow>[] = [
  { header: '번호', width: WIDTH_NO, align: 'center', value: (_r, i) => i + 1 },
  { header: '작성일자', width: WIDTH_DATE, align: 'center', value: (r) => r.writtenDate },
  { header: '공급자\n사업자등록번호', width: WIDTH_BIZNO, align: 'center', wrapText: true, value: (r) => r.counterpartyBizNo },
  { header: '상호', width: WIDTH_NAME, value: (r) => r.counterpartyName },
  { header: '합계금액', width: WIDTH_TOTAL, align: 'right', numFmt: AMOUNT_FORMAT, value: (r) => r.totalAmount },
  { header: '공급가액', width: WIDTH_SUPPLY, align: 'right', numFmt: AMOUNT_FORMAT, value: (r) => r.supplyAmount },
  { header: '세액', width: WIDTH_TAX, align: 'right', numFmt: AMOUNT_FORMAT, value: (r) => r.taxAmount },
  { header: '품목명', width: WIDTH_ITEM, value: (r) => r.itemName },
  { header: '유형', width: WIDTH_ISSUETYPE, align: 'center', value: (r) => r.issueType },
  { header: '유형', width: WIDTH_TAXTYPE, align: 'center', value: (r) => r.taxType },
  { header: '전표처리', width: WIDTH_ACCOUNT, align: 'center', value: (r) => r.accountCode },
  { header: '', width: WIDTH_SITECODE, align: 'center', numFmt: AMOUNT_FORMAT, value: (r) => r.siteCode ?? '' },
  { header: '', width: WIDTH_PAYBASIS, align: 'center', value: (r) => r.paymentBasisAccount },
  { header: '결제일', width: WIDTH_PAYDATE, align: 'center', numFmt: DATE_FORMAT, value: (r) => parseDateOnlyToDate(r.paymentDate) },
  { header: '비고', width: WIDTH_NOTE, align: 'left', value: (r) => r.note },
  { header: '프로젝트', width: WIDTH_PROJECT, align: 'center', value: (r) => r.project },
  { header: '세부내역', width: WIDTH_DETAIL, align: 'center', value: (r) => r.detail },
]
// 유형(9,10열)만 병합 — 전표처리(11열)는 병합하지 않고, 구분번호/대금기준(12,13열)은 헤더 텍스트가 없다.
const PURCHASE_HEADER_MERGES: [number, number][] = [[9, 10]]
const PURCHASE_AMOUNT_COLS = [5, 6, 7]

function applyRangeStyle(
  ws: ExcelJS.Worksheet,
  row: number,
  startCol: number,
  endCol: number,
  fill: ExcelJS.Fill,
  border: Partial<ExcelJS.Borders>,
  alignment: Partial<ExcelJS.Alignment>,
) {
  for (let c = startCol; c <= endCol; c++) {
    const cell = ws.getRow(row).getCell(c)
    cell.font = FONT
    cell.fill = fill
    cell.border = border
    cell.alignment = alignment
  }
}

function buildInvoiceSheet(
  wb: ExcelJS.Workbook,
  sheetName: string,
  titleText: string,
  columns: ColumnSpec<TaxInvoiceRow>[],
  headerMerges: [number, number][],
  amountCols: number[],
  rows: TaxInvoiceRow[],
): ExcelJS.Worksheet {
  const ws = wb.addWorksheet(sheetName)
  ws.properties.dyDescent = SHEET_DY_DESCENT
  ws.views = [SHEET_VIEW]
  const lastCol = columns.length

  columns.forEach((col, i) => {
    ws.getColumn(i + 1).width = col.width
  })

  // 1행: 제목(A:H 병합) + 회사명(I:마지막열 병합)
  ws.mergeCells(1, 1, 1, 8)
  ws.mergeCells(1, 9, 1, lastCol)
  ws.getCell(1, 1).value = titleText
  ws.getCell(1, 9).value = COMPANY_NAME
  applyRangeStyle(ws, 1, 1, 8, HEADER_FILL_PLAIN, THIN_BORDER_AUTO, { horizontal: 'center', vertical: 'middle' })
  applyRangeStyle(ws, 1, 9, lastCol, HEADER_FILL_ACCENT, THIN_BORDER_AUTO, { horizontal: 'center', vertical: 'middle' })
  ws.getRow(1).height = ROW_HEIGHTS.title

  // 2행: 컬럼 헤더
  columns.forEach((col, i) => {
    const c = i + 1
    const cell = ws.getCell(2, c)
    cell.value = col.header
    cell.font = FONT
    cell.fill = c < ACCENT_ZONE_START_COL ? HEADER_FILL_PLAIN : HEADER_FILL_ACCENT
    cell.border = THIN_BORDER_AUTO
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: col.wrapText }
  })
  for (const [start, end] of headerMerges) ws.mergeCells(2, start, 2, end)
  ws.getRow(2).height = ROW_HEIGHTS.header

  // 3행~: 데이터
  rows.forEach((r, i) => {
    const rowNum = 3 + i
    columns.forEach((col, ci) => {
      const c = ci + 1
      const cell = ws.getCell(rowNum, c)
      const v = col.value(r, i)
      cell.value = v === '' ? null : v
      cell.font = FONT
      cell.border = THIN_BORDER_DATA
      cell.alignment = { horizontal: col.align, vertical: 'middle' }
      if (col.numFmt) cell.numFmt = col.numFmt
    })
    ws.getRow(rowNum).height = ROW_HEIGHTS.data
  })

  // 합계 행: 합계금액/공급가액/세액 SUM 수식(라벨 없음, 테두리·배경 없음 — 템플릿과 동일)
  const totalsRowNum = 3 + rows.length
  const dataStartRow = 3
  const dataEndRow = 2 + rows.length
  for (const c of amountCols) {
    const colLetter = ws.getColumn(c).letter
    const sum = rows.reduce((s, r) => {
      const spec = columns[c - 1]
      const v = spec.value(r, 0)
      return s + (typeof v === 'number' ? v : 0)
    }, 0)
    const cell = ws.getCell(totalsRowNum, c)
    cell.value = { formula: `SUM(${colLetter}${dataStartRow}:${colLetter}${dataEndRow})`, result: sum }
    cell.font = FONT
    cell.numFmt = AMOUNT_FORMAT
    cell.alignment = { vertical: 'middle' }
  }
  ws.getRow(totalsRowNum).height = ROW_HEIGHTS.footer

  return ws
}

function buildSalesInvoiceSheet(wb: ExcelJS.Workbook, group: MonthGroup): ExcelJS.Worksheet {
  const titleText = group.month ? `매출세금계산서(${group.year}_${group.month})` : '매출세금계산서'
  const sheetName = sanitizeSheetName(group.month ? `매출세금계산서(${group.month}월)` : '매출세금계산서')
  return buildInvoiceSheet(wb, sheetName, titleText, SALES_COLUMNS, SALES_HEADER_MERGES, SALES_AMOUNT_COLS, group.rows)
}

function buildPurchaseInvoiceSheet(wb: ExcelJS.Workbook, group: MonthGroup): ExcelJS.Worksheet {
  const titleText = group.month ? `매입세금계산서(${group.year}_${group.month})` : '매입세금계산서'
  const sheetName = sanitizeSheetName(group.month ? `매입세금계산서(${group.month}월)` : '매입세금계산서')
  return buildInvoiceSheet(wb, sheetName, titleText, PURCHASE_COLUMNS, PURCHASE_HEADER_MERGES, PURCHASE_AMOUNT_COLS, group.rows)
}

// PRD 7.2.1 출력 양식 (템플릿 파일에는 영수증 시트가 없어 세금계산서 시트와 동일한 행 높이·열 너비·글꼴
// 크기만 맞추고, 그 외 배경색·테두리 등 스타일은 넣지 않는다)
const RECEIPT_COLUMNS: { header: string; width: number }[] = [
  { header: '날짜', width: RECEIPT_WIDTH_DATE },
  { header: '거래처명', width: RECEIPT_WIDTH_NAME },
  { header: '공급가액', width: RECEIPT_WIDTH_SUPPLY },
  { header: '세액', width: RECEIPT_WIDTH_TAX },
  { header: '합계', width: RECEIPT_WIDTH_TOTAL },
  { header: '현장명', width: RECEIPT_WIDTH_SITENAME },
  { header: '내역', width: RECEIPT_WIDTH_DESCRIPTION },
  { header: '계정과목', width: RECEIPT_WIDTH_ACCOUNT },
  { header: '구분', width: RECEIPT_WIDTH_SITECODE },
  { header: '과세유형', width: RECEIPT_WIDTH_TAXTYPE },
  { header: '세부내역', width: RECEIPT_WIDTH_DETAIL },
]

function buildReceiptSheet(wb: ExcelJS.Workbook, sheet: ReceiptSheet) {
  const ws = wb.addWorksheet(sanitizeSheetName(sheet.name))
  ws.properties.dyDescent = SHEET_DY_DESCENT
  ws.views = [SHEET_VIEW]

  RECEIPT_COLUMNS.forEach((col, i) => {
    ws.getColumn(i + 1).width = col.width
  })

  const headerRow = ws.addRow(RECEIPT_COLUMNS.map((col) => col.header))
  headerRow.height = ROW_HEIGHTS.header
  headerRow.eachCell((cell) => {
    cell.font = FONT
  })

  for (const r of sheet.rows) {
    const row = ws.addRow([
      r.date,
      r.merchantName,
      r.supplyAmount,
      r.taxAmount,
      r.totalAmount,
      r.siteName,
      r.description,
      r.accountCode,
      r.siteCode ?? '',
      r.taxType,
      r.detail,
    ])
    row.height = ROW_HEIGHTS.data
    row.eachCell((cell) => {
      cell.font = FONT
    })
  }
}

// 엑셀 시트명 제약(최대 31자, \ / ? * [ ] : 사용 불가)에 맞춰 정리한다.
function sanitizeSheetName(name: string): string {
  const cleaned = name.replace(/[\\/?*[\]:]/g, '').trim()
  return (cleaned || 'Sheet').slice(0, 31)
}

export function buildSalesWorkbook(rows: TaxInvoiceRow[]): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook()
  for (const group of groupTaxInvoiceRowsByMonth(rows)) buildSalesInvoiceSheet(wb, group)
  return wb
}

export function buildPurchaseWorkbook(rows: TaxInvoiceRow[]): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook()
  for (const group of groupTaxInvoiceRowsByMonth(rows)) buildPurchaseInvoiceSheet(wb, group)
  return wb
}

// 모달 안에서 "선택한 월만" 다운로드할 때 쓴다 — rows는 이미 해당 월로 필터된 목록이고,
// monthKey('YYYY-MM' 또는 작성일자 미상은 '')로 시트 제목에 들어갈 연/월을 결정한다.
function buildSalesMonthWorkbook(rows: TaxInvoiceRow[], monthKey: string): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook()
  const [year, month] = monthKey ? (monthKey.split('-') as [string, string]) : ['', '']
  buildSalesInvoiceSheet(wb, { year, month, rows })
  return wb
}

function buildPurchaseMonthWorkbook(rows: TaxInvoiceRow[], monthKey: string): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook()
  const [year, month] = monthKey ? (monthKey.split('-') as [string, string]) : ['', '']
  buildPurchaseInvoiceSheet(wb, { year, month, rows })
  return wb
}

function buildReceiptWorkbook(sheets: ReceiptSheet[]): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook()
  for (const sheet of sheets) buildReceiptSheet(wb, sheet)
  return wb
}

function todayFileStamp(): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${yyyy}${mm}${dd}`
}

async function triggerDownload(wb: ExcelJS.Workbook, filename: string): Promise<void> {
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  } finally {
    URL.revokeObjectURL(url)
  }
}

// 세금계산서(매출/매입) 모달 안의 "전체 다운로드" 버튼에서 쓴다 — 월별 시트를 모두 담은 파일 하나.
export async function downloadSalesWorkbook(rows: TaxInvoiceRow[]): Promise<void> {
  await triggerDownload(buildSalesWorkbook(rows), `매출세금계산서_${todayFileStamp()}.xlsx`)
}

export async function downloadPurchaseWorkbook(rows: TaxInvoiceRow[]): Promise<void> {
  await triggerDownload(buildPurchaseWorkbook(rows), `매입세금계산서_${todayFileStamp()}.xlsx`)
}

// 세금계산서(매출/매입) 모달 안의 "선택 월 다운로드" 버튼에서 쓴다 — 현재 선택된 월의 데이터만 시트 하나로.
export async function downloadSalesMonthWorkbook(rows: TaxInvoiceRow[], monthKey: string): Promise<void> {
  await triggerDownload(buildSalesMonthWorkbook(rows, monthKey), `매출세금계산서_${monthKey || '미상'}_${todayFileStamp()}.xlsx`)
}

export async function downloadPurchaseMonthWorkbook(rows: TaxInvoiceRow[], monthKey: string): Promise<void> {
  await triggerDownload(
    buildPurchaseMonthWorkbook(rows, monthKey),
    `매입세금계산서_${monthKey || '미상'}_${todayFileStamp()}.xlsx`,
  )
}

// 영수증 모달 안의 "엑셀 다운" 버튼에서 쓴다 — 카드별 시트를 모두 담은 파일 하나.
export async function downloadReceiptWorkbook(sheets: ReceiptSheet[]): Promise<void> {
  await triggerDownload(buildReceiptWorkbook(sheets), `영수증_${todayFileStamp()}.xlsx`)
}
