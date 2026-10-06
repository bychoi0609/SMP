import { cellText, parseAmount, parseDateOnly } from './format'
import type { RawSheet } from './excelRead'
import type { ReceiptEntry } from './parseReceipt'
import { deriveDetailForSiteCode } from './siteCode'

// 법인카드(양식).xlsx — 시트별로 "날짜/거래처명/공급가액/세액/합계/현장명/내역" 컬럼을 가지며,
// 카드번호 컬럼은 없는 대신 시트명 안에 카드 뒷자리 4자리가 들어있다(예: "1807 임채환").
// "엑셀 다운"으로 받은 파일은 그 뒤에 계정과목/구분/과세유형/세부내역 컬럼이 더 있으므로,
// 해당 헤더가 있으면 함께 읽는다(없으면 기존 7칸 양식으로 동작).
const HEADER = ['날짜', '거래처명', '공급가액', '세액', '합계', '현장명', '내역'] as const
const OPTIONAL_HEADER = { accountCode: '계정과목', siteCode: '구분', detail: '세부내역' } as const

function isReceiptMappingHeader(row: string[] | undefined): boolean {
  if (!row) return false
  return HEADER.every((h, i) => cellText(row[i]) === h)
}

function isBlankRow(row: string[] | undefined): boolean {
  return !row || row.every((cell) => cellText(cell) === '')
}

function parseSiteCode(raw: unknown): number | null {
  const text = cellText(raw).replace(/,/g, '')
  if (text === '') return null
  const n = Number(text)
  return Number.isNaN(n) ? null : n
}

export function extractLast4FromSheetName(sheetName: string): string | null {
  const match = sheetName.match(/(\d{4})/)
  return match ? match[1] : null
}

export interface ReceiptMappingRow {
  last4: string
  date: string
  merchantName: string
  supplyAmount: number
  taxAmount: number
  totalAmount: number
  siteName: string
  description: string
  accountCode: string
  siteCode: number | null
  detail: string
}

// 시트 하나(카드 1개)에서 매핑 후보 행을 뽑는다. 시트명에 카드 뒷자리 4개가 없거나 헤더를 찾지
// 못하면(=이 양식이 아니면) 빈 배열을 반환한다. 채울 값(현장명/내역/계정과목/구분/세부내역)이
// 하나도 없는 행은 제외한다.
export function parseReceiptMappingSheet(sheet: RawSheet): ReceiptMappingRow[] {
  const last4 = extractLast4FromSheetName(sheet.name)
  if (!last4) return []

  const headerRowIndex = sheet.rows.findIndex((row) => isReceiptMappingHeader(row))
  if (headerRowIndex === -1) return []

  const header = sheet.rows[headerRowIndex].map((cell) => cellText(cell))
  const optionalIndex = (name: string) => {
    const i = header.indexOf(name, HEADER.length)
    return i === -1 ? null : i
  }
  const accountCodeCol = optionalIndex(OPTIONAL_HEADER.accountCode)
  const siteCodeCol = optionalIndex(OPTIONAL_HEADER.siteCode)
  const detailCol = optionalIndex(OPTIONAL_HEADER.detail)

  return sheet.rows
    .slice(headerRowIndex + 1)
    .filter((row) => !isBlankRow(row))
    .map((row) => ({
      last4,
      date: parseDateOnly(row[0]),
      merchantName: cellText(row[1]),
      supplyAmount: parseAmount(row[2]),
      taxAmount: parseAmount(row[3]),
      totalAmount: parseAmount(row[4]),
      siteName: cellText(row[5]),
      description: cellText(row[6]),
      accountCode: accountCodeCol === null ? '' : cellText(row[accountCodeCol]),
      siteCode: siteCodeCol === null ? null : parseSiteCode(row[siteCodeCol]),
      detail: detailCol === null ? '' : cellText(row[detailCol]),
    }))
    .filter(
      (row) =>
        row.siteName !== '' ||
        row.description !== '' ||
        row.accountCode !== '' ||
        row.siteCode !== null ||
        row.detail !== '',
    )
}

export interface ReceiptMappingResult {
  entries: ReceiptEntry[]
  matchedCount: number
  unmatchedCount: number
}

function matchKey(
  last4: string,
  date: string,
  merchantName: string,
  supplyAmount: number,
  taxAmount: number,
  totalAmount: number,
): string {
  return [last4, date, merchantName, supplyAmount, taxAmount, totalAmount].join('|')
}

// mappingRows 각각에 대해 (카드/날짜/거래처명/공급가액/세액/합계)가 모두 일치하는 entries 행을 찾아
// 엑셀에 값이 있는 칸(현장명/내역/계정과목/구분/세부내역)만 덮어쓰고, 빈칸은 기존 값을 유지한다.
// 구분만 있고 세부내역이 비어 있으면 구분 기준으로 세부내역을 자동으로 채운다(엑셀 세부내역이 우선).
// 같은 값의 행이 여러 건이면 앞에서부터 순서대로 하나씩 소진해 매칭한다.
export function applyReceiptMapping(entries: ReceiptEntry[], mappingRows: ReceiptMappingRow[]): ReceiptMappingResult {
  const indexByKey = new Map<string, number[]>()
  entries.forEach((entry, i) => {
    const k = matchKey(
      entry.last4,
      entry.row.date,
      entry.row.merchantName,
      entry.row.supplyAmount,
      entry.row.taxAmount,
      entry.row.totalAmount,
    )
    const list = indexByKey.get(k) ?? []
    list.push(i)
    indexByKey.set(k, list)
  })

  const nextEntries = [...entries]
  let matchedCount = 0
  let unmatchedCount = 0

  for (const mapping of mappingRows) {
    const k = matchKey(
      mapping.last4,
      mapping.date,
      mapping.merchantName,
      mapping.supplyAmount,
      mapping.taxAmount,
      mapping.totalAmount,
    )
    const targetIndex = indexByKey.get(k)?.shift()
    if (targetIndex === undefined) {
      unmatchedCount++
      continue
    }
    const entry = nextEntries[targetIndex]
    const siteCode = mapping.siteCode ?? entry.row.siteCode
    const detail =
      mapping.detail !== ''
        ? mapping.detail
        : mapping.siteCode !== null
          ? deriveDetailForSiteCode(mapping.siteCode, entry.row.detail)
          : entry.row.detail
    nextEntries[targetIndex] = {
      ...entry,
      row: {
        ...entry.row,
        siteName: mapping.siteName || entry.row.siteName,
        description: mapping.description || entry.row.description,
        accountCode: mapping.accountCode || entry.row.accountCode,
        siteCode,
        detail,
      },
    }
    matchedCount++
  }

  return { entries: nextEntries, matchedCount, unmatchedCount }
}
