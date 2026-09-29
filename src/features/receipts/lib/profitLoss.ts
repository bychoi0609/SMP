import type { ReceiptCardRowDTO, TaxInvoiceRowDTO } from '@/app/receipts/actions'

// 손익계산서 집계 — 확정된 세금계산서(매출/매입)·카드 영수증 + 수기 항목을 기간(연도별 또는 월별) 열로 모은다.
// 분류 규칙은 이 파일 상단 상수에 모아둔다(규칙이 바뀌면 여기만 고치면 되도록).

export type ProfitLossSection =
  | 'REVENUE'
  | 'CONSTRUCTION_COST'
  | 'MANUFACTURING_COST'
  | 'MERCHANDISE_COST'
  | 'SGA'
  | 'NON_OPERATING_INCOME'
  | 'NON_OPERATING_EXPENSE'
  | 'UNCLASSIFIED'

export type ManualSection = Exclude<ProfitLossSection, 'UNCLASSIFIED'>

export const SECTION_LABEL: Record<ProfitLossSection, string> = {
  REVENUE: '매출액',
  CONSTRUCTION_COST: '공사원가',
  MANUFACTURING_COST: '제조원가',
  MERCHANDISE_COST: '상품원가',
  SGA: '판매관리비',
  NON_OPERATING_INCOME: '영업외수익',
  NON_OPERATING_EXPENSE: '영업외비용',
  UNCLASSIFIED: '미분류 매입',
}

// 수기 항목에서 고를 수 있는 구분(미분류는 자동 집계 전용).
export const MANUAL_SECTIONS: ManualSection[] = [
  'REVENUE',
  'CONSTRUCTION_COST',
  'MANUFACTURING_COST',
  'MERCHANDISE_COST',
  'SGA',
  'NON_OPERATING_INCOME',
  'NON_OPERATING_EXPENSE',
]

// 매입(세금계산서·영수증)의 세부내역 → 원가 구분. 세금계산서는 본사 비용을 "사무실"로, 영수증은
// 구분 8번 자동 채움값인 "SC본사"로 적기 때문에 둘 다 판관비로 본다. 여기 없는 값/빈 값은 미분류.
export const DETAIL_TO_SECTION: Record<string, ProfitLossSection> = {
  공사: 'CONSTRUCTION_COST',
  제조: 'MANUFACTURING_COST',
  상품: 'MERCHANDISE_COST',
  사무실: 'SGA',
  SC본사: 'SGA',
}

// 부가세를 공제받지 못하는 과세유형 — 이 경우 부가세도 비용이라 합계금액을, 나머지는 공급가액을 쓴다.
const NON_DEDUCTIBLE_INVOICE_TAX_TYPES = ['불공']
const NON_DEDUCTIBLE_RECEIPT_TAX_TYPES = ['불공', '간이']

const NO_ACCOUNT_LABEL = '(계정과목 없음)'

export interface ManualEntryDTO {
  id: number
  billingYearMonth: string
  section: ManualSection
  accountCode: string
  amount: number
  memo: string
}

export type SourceKind = 'sales' | 'purchase' | 'receipt' | 'manual'

export const SOURCE_KIND_LABEL: Record<SourceKind, string> = {
  sales: '매출 세금계산서',
  purchase: '매입 세금계산서',
  receipt: '카드 영수증',
  manual: '수기',
}

// 손익 셀을 구성하는 원천 한 건 — 셀 클릭 시 상세 모달에 그대로 보여준다.
export interface SourceItem {
  kind: SourceKind
  id: number
  columnIndex: number // 이 건이 속한 열(연도별이면 연도, 월별이면 월)
  monthKey: string // 'YYYY-MM' — 상세 모달의 월별 금액 띠/월 필터용
  accountCode: string
  date: string
  counterparty: string
  description: string
  detail: string
  taxType: string
  amount: number
}

export interface ProfitLossLine {
  accountCode: string
  values: number[] // 열 개수만큼
  total: number
  hasManual: boolean
  items: SourceItem[]
}

export interface SectionResult {
  section: ProfitLossSection
  lines: ProfitLossLine[]
  values: number[]
  total: number
}

export interface Series {
  values: number[]
  total: number
}

export interface ProfitLoss {
  columns: string[] // 열 키: 연도별이면 ['2025', '2026'], 월별이면 ['2026-01', …, '2026-12']
  sections: Record<ProfitLossSection, SectionResult>
  costOfSales: Series
  grossProfit: Series
  operatingIncome: Series
  netIncome: Series
}

export function classifyPurchaseDetail(detail: string): ProfitLossSection {
  return DETAIL_TO_SECTION[detail.trim()] ?? 'UNCLASSIFIED'
}

export function invoiceCostAmount(row: Pick<TaxInvoiceRowDTO, 'taxType' | 'supplyAmount' | 'totalAmount'>): number {
  return NON_DEDUCTIBLE_INVOICE_TAX_TYPES.includes(row.taxType.trim()) ? row.totalAmount : row.supplyAmount
}

export function receiptCostAmount(row: { taxType: string; supplyAmount: number; totalAmount: number }): number {
  return NON_DEDUCTIBLE_RECEIPT_TAX_TYPES.includes(row.taxType.trim()) ? row.totalAmount : row.supplyAmount
}

// 'YYYY-MM' 또는 'YYYY-MM-DD'가 해당 연도면 0~11 월 인덱스, 아니면 -1.
function monthIndexOf(dateOrMonth: string, year: string): number {
  const m = /^(\d{4})-(\d{2})/.exec(dateOrMonth)
  if (!m || m[1] !== year) return -1
  const idx = Number(m[2]) - 1
  return idx >= 0 && idx < 12 ? idx : -1
}

const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0)

export interface ProfitLossSourceData {
  sales: TaxInvoiceRowDTO[]
  purchases: TaxInvoiceRowDTO[]
  receipts: ReceiptCardRowDTO[]
  manual: ManualEntryDTO[]
}

// 집계 본체 — 기간 축(열)과 무관하게 동작한다. columnIndexOf가 -1을 돌려주는 건은 제외.
export function buildProfitLoss(
  { sales, purchases, receipts, manual }: ProfitLossSourceData,
  columns: string[],
  columnIndexOf: (dateOrMonth: string) => number,
): ProfitLoss {
  const zeros = () => columns.map(() => 0)
  const series = (values: number[]): Series => ({ values, total: sum(values) })
  const combine = (parts: { values: number[] }[], signs: number[]) =>
    zeros().map((_, i) => parts.reduce((s, p, pi) => s + signs[pi] * p.values[i], 0))

  // section → accountCode → line
  const buckets = new Map<ProfitLossSection, Map<string, ProfitLossLine>>()

  function add(
    section: ProfitLossSection,
    accountCode: string,
    dateOrMonth: string,
    item: Omit<SourceItem, 'columnIndex' | 'monthKey' | 'accountCode'>,
  ) {
    // 금액 0원 행(정리 화면의 빈 행 등)은 손익에 영향이 없고 "(계정과목 없음)" 같은 빈 줄만 만든다.
    if (item.amount === 0) return
    const columnIndex = columnIndexOf(dateOrMonth)
    if (columnIndex < 0) return
    const account = accountCode.trim() || NO_ACCOUNT_LABEL
    if (!buckets.has(section)) buckets.set(section, new Map())
    const lines = buckets.get(section)!
    if (!lines.has(account)) {
      lines.set(account, { accountCode: account, values: zeros(), total: 0, hasManual: false, items: [] })
    }
    const line = lines.get(account)!
    line.values[columnIndex] += item.amount
    line.total += item.amount
    if (item.kind === 'manual') line.hasManual = true
    line.items.push({ ...item, columnIndex, monthKey: dateOrMonth.slice(0, 7), accountCode: account })
  }

  for (const r of sales) {
    add('REVENUE', r.accountCode, r.writtenDate, {
      kind: 'sales',
      id: r.id,
      date: r.writtenDate,
      counterparty: r.counterpartyName,
      description: r.itemName,
      detail: r.detail,
      taxType: r.taxType,
      amount: r.supplyAmount,
    })
  }

  for (const r of purchases) {
    add(classifyPurchaseDetail(r.detail), r.accountCode, r.writtenDate, {
      kind: 'purchase',
      id: r.id,
      date: r.writtenDate,
      counterparty: r.counterpartyName,
      description: r.itemName,
      detail: r.detail,
      taxType: r.taxType,
      amount: invoiceCostAmount(r),
    })
  }

  for (const { id, row } of receipts) {
    add(classifyPurchaseDetail(row.detail), row.accountCode, row.date, {
      kind: 'receipt',
      id,
      date: row.date,
      counterparty: row.merchantName,
      description: [row.siteName, row.description].filter(Boolean).join(' · '),
      detail: row.detail,
      taxType: row.taxType,
      amount: receiptCostAmount(row),
    })
  }

  for (const e of manual) {
    add(e.section, e.accountCode, e.billingYearMonth, {
      kind: 'manual',
      id: e.id,
      date: e.billingYearMonth,
      counterparty: '',
      description: e.memo,
      detail: '',
      taxType: '',
      amount: e.amount,
    })
  }

  const sections = {} as Record<ProfitLossSection, SectionResult>
  for (const section of Object.keys(SECTION_LABEL) as ProfitLossSection[]) {
    // 계정과목 줄은 기간 합계 금액이 큰 순서로(같으면 이름순) 보여준다.
    const lines = [...(buckets.get(section)?.values() ?? [])].sort(
      (a, b) => b.total - a.total || a.accountCode.localeCompare(b.accountCode, 'ko'),
    )
    for (const line of lines) line.items.sort((a, b) => a.date.localeCompare(b.date))
    const values = zeros().map((_, i) => sum(lines.map((l) => l.values[i])))
    sections[section] = { section, lines, values, total: sum(values) }
  }

  const s = sections
  const costOfSales = series(combine([s.CONSTRUCTION_COST, s.MANUFACTURING_COST, s.MERCHANDISE_COST], [1, 1, 1]))
  const grossProfit = series(combine([s.REVENUE, costOfSales], [1, -1]))
  // 미분류 매입도 비용이므로 영업이익에서 뺀다(빠뜨리면 이익이 부풀려짐) — 화면에서는 경고와 함께 따로 표시.
  const operatingIncome = series(combine([grossProfit, s.SGA, s.UNCLASSIFIED], [1, -1, -1]))
  const netIncome = series(combine([operatingIncome, s.NON_OPERATING_INCOME, s.NON_OPERATING_EXPENSE], [1, 1, -1]))

  return { columns, sections, costOfSales, grossProfit, operatingIncome, netIncome }
}

// 선택 연도의 1~12월 열.
export function monthlyProfitLoss(data: ProfitLossSourceData, year: string): ProfitLoss {
  const columns = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`)
  return buildProfitLoss(data, columns, (d) => monthIndexOf(d, year))
}

// 연도별 열(years는 오름차순 'YYYY' 목록).
export function yearlyProfitLoss(data: ProfitLossSourceData, years: string[]): ProfitLoss {
  return buildProfitLoss(data, years, (d) => years.indexOf(d.slice(0, 4)))
}

// 화면 표와 엑셀이 같은 행 구성을 쓰도록 평탄화한 행 목록.
export type DisplayRowKind = 'group' | 'section' | 'line' | 'profit'

export interface DisplayRow {
  key: string // 연도별/월별 결과 사이에서 같은 행을 찾는 키로도 쓴다
  label: string
  kind: DisplayRowKind
  depth: number // 들여쓰기 단계
  values: number[]
  total: number
  collapseKey?: string // 이 행을 접으면 숨겨지는 자식들의 키 (section/group 행에만)
  parentKeys: string[] // 이 행을 숨기는 조상 collapseKey들
  line?: ProfitLossLine
  section?: ProfitLossSection
  warning?: boolean
}

const COST_OF_SALES_SECTIONS: ProfitLossSection[] = ['CONSTRUCTION_COST', 'MANUFACTURING_COST', 'MERCHANDISE_COST']

export function flattenProfitLoss(pl: ProfitLoss): DisplayRow[] {
  const rows: DisplayRow[] = []
  const s = pl.sections

  function pushSection(section: ProfitLossSection, depth: number, parentKeys: string[], opts?: { warning?: boolean }) {
    const res = s[section]
    const collapseKey = `section:${section}`
    rows.push({
      key: collapseKey,
      label: SECTION_LABEL[section],
      kind: 'section',
      depth,
      values: res.values,
      total: res.total,
      collapseKey,
      parentKeys,
      section,
      warning: opts?.warning,
    })
    for (const line of res.lines) {
      rows.push({
        key: `line:${section}:${line.accountCode}`,
        label: line.accountCode,
        kind: 'line',
        depth: depth + 1,
        values: line.values,
        total: line.total,
        parentKeys: [...parentKeys, collapseKey],
        line,
        section,
      })
    }
  }

  pushSection('REVENUE', 0, [])

  rows.push({
    key: 'group:cost',
    label: '매출원가',
    kind: 'group',
    depth: 0,
    ...pl.costOfSales,
    collapseKey: 'group:cost',
    parentKeys: [],
  })
  for (const section of COST_OF_SALES_SECTIONS) pushSection(section, 1, ['group:cost'])

  rows.push({ key: 'profit:gross', label: '매출총이익', kind: 'profit', depth: 0, ...pl.grossProfit, parentKeys: [] })

  pushSection('SGA', 0, [])
  if (s.UNCLASSIFIED.lines.length > 0) pushSection('UNCLASSIFIED', 0, [], { warning: true })

  rows.push({ key: 'profit:operating', label: '영업이익', kind: 'profit', depth: 0, ...pl.operatingIncome, parentKeys: [] })

  pushSection('NON_OPERATING_INCOME', 0, [])
  pushSection('NON_OPERATING_EXPENSE', 0, [])

  rows.push({ key: 'profit:net', label: '당기순이익(세전)', kind: 'profit', depth: 0, ...pl.netIncome, parentKeys: [] })

  return rows
}

// 행을 구성하는 원천 자료 — 계정과목 줄은 그 줄, 구분 소계는 소속 줄 전체, 이익 줄은 없음.
export function rowSourceItems(pl: ProfitLoss, row: DisplayRow): SourceItem[] {
  if (row.line) return row.line.items
  const sectionsOf = row.kind === 'group' ? COST_OF_SALES_SECTIONS : row.section ? [row.section] : []
  return sectionsOf
    .flatMap((section) => pl.sections[section].lines.flatMap((l) => l.items))
    .sort((a, b) => a.date.localeCompare(b.date))
}

// 확정 데이터·수기 항목에 등장하는 연도 목록(내림차순). 데이터가 없으면 기본 연도 하나.
export function availableYears(data: ProfitLossSourceData, fallbackYear: string): string[] {
  const years = new Set<string>([fallbackYear])
  for (const r of [...data.sales, ...data.purchases]) years.add(r.writtenDate.slice(0, 4))
  for (const r of data.receipts) years.add(r.row.date.slice(0, 4))
  for (const e of data.manual) years.add(e.billingYearMonth.slice(0, 4))
  return [...years].filter((y) => /^\d{4}$/.test(y)).sort().reverse()
}

// 매출 대비 비율(%) — 매출이 0인 칸은 null.
export function ratioOf(value: number, revenue: number): number | null {
  if (revenue === 0) return null
  return (value / revenue) * 100
}
