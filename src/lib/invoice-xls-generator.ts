import "server-only"
import * as XLSX from "xlsx"

import type { PlantMaster, SmpMonthly } from "@/generated/prisma/client"

// 실제 한전 세금계산서 일괄등록 양식(.xls)에서, 발전소별로 이미 채워져 있는
// 행을 "비고"(V열) 별칭으로 매칭해 값을 채워야 할 행 번호를 찾는다. 이 모듈은
// 매칭만 담당하며(읽기 전용), 실제 셀 입력은 서식(열너비·행높이·셀 음영 등)을
// 그대로 보존하기 위해 Excel(COM)로 처리한다 — invoice-xls-excel-writer 참고.
// (xlsx(SheetJS) 커뮤니티 에디션으로 재직렬화하면 행 높이·셀 배경색이 소실됨)

export const SHEET_NAME = "엑셀업로드양식"
const DATA_START_ROW = 7 // 1-indexed, 6행 헤더 다음부터 데이터

const COL = {
  WRITE_DATE: "B", // 작성일자
  SUPPLY_AMOUNT: "T", // 공급가액
  VAT_AMOUNT: "U", // 세액
  REMARK: "V", // 비고 (발전소 별칭 매칭용 — 값은 수정하지 않는다)
  ITEM1: "X", // 품목1
  SUPPLY_AMOUNT1: "AB", // 공급가액1
  VAT_AMOUNT1: "AC", // 세액1
} as const

// invoice-xls-excel-writer가 셀 입력 시 사용하는 열 위치 (단일 출처).
export const WRITE_COL = {
  WRITE_DATE: COL.WRITE_DATE,
  SUPPLY_AMOUNT: COL.SUPPLY_AMOUNT,
  VAT_AMOUNT: COL.VAT_AMOUNT,
  ITEM1: COL.ITEM1,
  SUPPLY_AMOUNT1: COL.SUPPLY_AMOUNT1,
  VAT_AMOUNT1: COL.VAT_AMOUNT1,
} as const

function toYyyymmdd(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}${m}${d}`
}

function itemLabel(billingYearMonth: string): string {
  const [y, m] = billingYearMonth.split("-")
  return `${y}년${m}월전력거래분`
}

function cellText(sheet: XLSX.WorkSheet, address: string): string {
  const cell = sheet[address]
  if (cell?.v === undefined || cell.v === null) return ""
  return String(cell.v).trim()
}

export type InvoiceRowInput = {
  plant: PlantMaster
  smpMonthly: SmpMonthly
}

// Excel(COM)에 그대로 넘겨 지정된 행의 셀 값만 입력시키기 위한 최소 정보.
// 컬럼 위치(COL)는 이 모듈이 알고, 실제 입력은 invoice-xls-excel-writer가 한다.
export type InvoiceCellWrite = {
  row: number
  writeDate: string
  supplyAmount: number
  vatAmount: number
  item1: string
}

export type MatchTemplateResult = {
  writes: InvoiceCellWrite[]
  matchedSmpMonthlyIds: number[]
  unmatchedPlantNames: string[]
}

// 템플릿 시트의 "비고"(V열)에 이미 적혀 있는 발전소 별칭을 기준으로 대상 행을
// 찾는다. 별칭이 일치하는 행이 없는 발전소는 건너뛰고 unmatchedPlantNames로
// 반환한다 — 양식에 새 행을 추가하는 것은 이 함수의 책임이 아니다.
export function matchInvoiceTemplateRows(
  templateBuffer: Buffer,
  rows: InvoiceRowInput[],
  billingYearMonth: string,
  issueDate: Date,
): MatchTemplateResult {
  const workbook = XLSX.read(templateBuffer, { type: "buffer" })
  const sheet = workbook.Sheets[SHEET_NAME]
  if (!sheet) {
    throw new Error(`양식 파일에서 "${SHEET_NAME}" 시트를 찾을 수 없습니다.`)
  }

  const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1:A1")

  const rowByAlias = new Map<string, number>()
  for (let r = DATA_START_ROW; r <= range.e.r + 1; r++) {
    const alias = cellText(sheet, `${COL.REMARK}${r}`)
    if (alias) rowByAlias.set(alias, r)
  }

  const issueDateStr = toYyyymmdd(issueDate)
  const item1 = itemLabel(billingYearMonth)

  const writes: InvoiceCellWrite[] = []
  const matchedSmpMonthlyIds: number[] = []
  const unmatchedPlantNames: string[] = []

  for (const { plant, smpMonthly } of rows) {
    const alias = plant.plantAlias?.trim()
    const rowNo = alias ? rowByAlias.get(alias) : undefined

    if (!rowNo) {
      unmatchedPlantNames.push(plant.plantAlias || plant.plantName)
      continue
    }

    const supplyAmount = Number(smpMonthly.supplyAmount ?? 0)
    const vatAmount = Number(smpMonthly.vatAmount ?? 0)

    writes.push({ row: rowNo, writeDate: issueDateStr, supplyAmount, vatAmount, item1 })
    matchedSmpMonthlyIds.push(smpMonthly.id)
  }

  return { writes, matchedSmpMonthlyIds, unmatchedPlantNames }
}
