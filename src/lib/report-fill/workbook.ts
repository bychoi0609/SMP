import ExcelJS from "exceljs"

import type { BillingStatus } from "@/lib/billing-status"
import type { LedgerCell } from "@/lib/revenue-ledger"

// 제출 엑셀(키스트론 매출 보고서 3종)에 한 달 치 값을 채운다.
// 파일을 새로 만들지 않고 올라온 파일의 해당 월 "입력 칸"만 값으로 덮어쓴다.
// 발전시간·합계·총합 같은 수식 칸은 그대로 두고, 열 때 Excel이 다시 계산하게 한다.

export type ReportKind = "PLANT_SHEET" | "INTEGRATED_BLOCK" | "SALES_ROW"

export const REPORT_KIND_LABEL: Record<ReportKind, string> = {
  PLANT_SHEET: "1번 매출 보고서(발전소별)",
  INTEGRATED_BLOCK: "2번 매출 보고서(통합 확정본)",
  SALES_ROW: "3번 월별 태양광 발전량(판매금액 기준)",
}

// 파일 안에서 발전소 하나를 가리키는 자리. apply로 그 달 값을 쓴다.
export type ReportTarget = {
  label: string // normalizeReportLabel 적용된 이름
  capacityKw: number | null
  apply: (cell: LedgerCell) => void
}

export type DetectResult =
  | { ok: true; kind: ReportKind; targets: ReportTarget[]; warnings: string[] }
  | { ok: false; error: string }

// 공백·줄바꿈을 한 칸으로 줄여 같은 이름을 같은 값으로 본다.
export function normalizeReportLabel(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

function cellText(cell: ExcelJS.Cell): string {
  const v = cell.value
  if (v === null || v === undefined) return ""
  if (typeof v === "object") {
    if ("richText" in v) return v.richText.map((t) => t.text).join("")
    if ("result" in v) return v.result === undefined || v.result === null ? "" : String(v.result)
    if ("text" in v) return String(v.text)
    return ""
  }
  return String(v)
}

function cellNumber(cell: ExcelJS.Cell): number | null {
  const v = cell.value
  const raw = typeof v === "object" && v !== null && "result" in v ? v.result : v
  const n = typeof raw === "number" ? raw : Number(raw)
  return raw === null || raw === undefined || raw === "" || Number.isNaN(n) ? null : n
}

// 공백을 모두 뺀 비교용 텍스트("구 분" = "구분")
function compact(cell: ExcelJS.Cell): string {
  return cellText(cell).replace(/\s+/g, "")
}

export async function loadReportWorkbook(buffer: ArrayBuffer): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)
  // exceljs는 셀이 하나도 없는 행을 저장하지 않아 그런 행의 "숨김"이 풀린다
  // (1번 파일의 연도 블록 사이 빈 구분 행). 빈 서식 셀을 하나 넣어 행을 남긴다.
  for (const sheet of workbook.worksheets) {
    sheet.eachRow({ includeEmpty: true }, (row) => {
      if (row.hidden && row.cellCount === 0) row.getCell(1).numFmt = "General"
    })
    unshareFormulas(sheet)
  }
  return workbook
}

// 공유 수식(Excel이 같은 수식을 아래로 복사할 때 쓰는 저장 방식)을 셀마다 일반 수식으로 푼다.
// 입력 칸에 값을 쓰다가 공유 수식의 원본 셀을 덮어쓰면 복사본 셀들이 깨지기 때문.
// 원본이 남아 있을 때 복사본 수식을 먼저 모두 계산한 뒤 한꺼번에 바꾼다.
function unshareFormulas(sheet: ExcelJS.Worksheet) {
  const updates: Array<{ cell: ExcelJS.Cell; formula: string; result: ExcelJS.CellFormulaValue["result"] }> = []
  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      const v = cell.value
      if (v && typeof v === "object" && ("sharedFormula" in v || "shareType" in v)) {
        const formula = cell.formula
        if (formula) updates.push({ cell, formula, result: (v as ExcelJS.CellFormulaValue).result })
      }
    })
  })
  for (const { cell, formula, result } of updates) {
    cell.value = { formula, result }
  }
}

export async function saveReportWorkbook(workbook: ExcelJS.Workbook): Promise<Buffer> {
  // 값이 바뀐 칸을 참조하는 수식의 저장된 결과는 옛 값이므로, 열 때 전부 다시 계산하게 한다.
  workbook.calcProperties = { ...workbook.calcProperties, fullCalcOnLoad: true }
  return Buffer.from(await workbook.xlsx.writeBuffer())
}

export function detectReportKind(workbook: ExcelJS.Workbook): ReportKind | null {
  const names = workbook.worksheets.map((s) => s.name.trim())
  if (names.some((n) => n.includes("판매금액 기준"))) return "SALES_ROW"
  if (names.some((n) => /^\d{4}년 실적$/.test(n))) return "INTEGRATED_BLOCK"
  if (workbook.worksheets.some(isPlantSheet)) return "PLANT_SHEET"
  return null
}

// 1번 발전소 시트: C5 "구 분", D6 "발전량 …"
function isPlantSheet(sheet: ExcelJS.Worksheet): boolean {
  return compact(sheet.getCell("C5")) === "구분" && compact(sheet.getCell("D6")).startsWith("발전량")
}

function statusText(status: BillingStatus): string | null {
  return status === "미청구" ? null : status
}

export function detectTargets(
  workbook: ExcelJS.Workbook,
  kind: ReportKind,
  month: string, // YYYY-MM
): DetectResult {
  const [year, mm] = month.split("-")
  const monthNumber = Number(mm)
  if (kind === "PLANT_SHEET") return detectPlantSheets(workbook, year, mm)
  if (kind === "INTEGRATED_BLOCK") return detectIntegratedBlocks(workbook, year, monthNumber)
  return detectSalesRows(workbook, year, monthNumber)
}

// 1번: 발전소 시트마다 C열 "26년 08월" 행의 D(발전량)·G(SMP금액)·H(REC수량)·I(REC금액)·K(비고).
// E(발전시간)·F(SMP단가)·J(매출액)는 수식이라 두고, 설비용량은 시트 아래 "설비용량" 표에서 읽는다.
function detectPlantSheets(workbook: ExcelJS.Workbook, year: string, mm: string): DetectResult {
  const rowLabel = `${year.slice(2)}년${mm}월`
  const targets: ReportTarget[] = []
  const warnings: string[] = []

  for (const sheet of workbook.worksheets.filter(isPlantSheet)) {
    let monthRow: number | null = null
    let capacityKw: number | null = null
    sheet.eachRow((row, r) => {
      if (monthRow === null && compact(row.getCell(3)) === rowLabel) monthRow = r
      if (capacityKw === null && compact(row.getCell(10)) === "설비용량") {
        capacityKw = cellNumber(sheet.getCell(r + 1, 10))
      }
    })
    if (monthRow === null) {
      warnings.push(`"${sheet.name}" 시트에 ${year.slice(2)}년 ${mm}월 행이 없어 건너뛰었어요.`)
      continue
    }
    const r = monthRow
    targets.push({
      label: normalizeReportLabel(sheet.name),
      capacityKw,
      apply: (cell) => {
        sheet.getCell(r, 4).value = cell.generationKwh
        sheet.getCell(r, 7).value = cell.smpAmount
        sheet.getCell(r, 8).value = cell.recQuantity
        sheet.getCell(r, 9).value = cell.recAmount
        sheet.getCell(r, 11).value = statusText(cell.status)
      },
    })
  }
  if (targets.length === 0 && warnings.length === 0) {
    return { ok: false, error: "발전소 시트를 찾지 못했어요." }
  }
  return { ok: true, kind: "PLANT_SHEET", targets, warnings }
}

const BLOCK_ROWS = ["발전량", "발전시간", "수평면일사량", "SMP단가", "SMP매출", "REC수량", "REC매출", "매출총액"]

// 2번: "{연도}년 실적" 시트. 발전소 8줄 블록마다 발전량·일사량·SMP단가·SMP매출·REC수량·REC매출을 쓴다.
// 발전시간·매출총액·차수 총합·키스트론 총합은 수식이라 둔다. 설비용량은 블록 8번째 줄 B열.
function detectIntegratedBlocks(
  workbook: ExcelJS.Workbook,
  year: string,
  monthNumber: number,
): DetectResult {
  const sheet = workbook.worksheets.find((s) => s.name.trim() === `${year}년 실적`)
  if (!sheet) return { ok: false, error: `"${year}년 실적" 시트가 없어요. 엑셀에서 시트를 추가한 뒤 다시 올려 주세요.` }

  let col: number | null = null
  sheet.getRow(1).eachCell((cell, c) => {
    if (col === null && compact(cell) === `${monthNumber}월`) col = c
  })
  if (col === null) return { ok: false, error: `"${sheet.name}" 시트 1행에서 ${monthNumber}월 열을 찾지 못했어요.` }
  const c = col

  const targets: ReportTarget[] = []
  for (let r = 1; r <= sheet.rowCount; r++) {
    const name = cellText(sheet.getCell(r, 2))
    if (compact(sheet.getCell(r, 3)) !== "발전량" || !name.trim()) continue
    if (compact(sheet.getCell(r, 1)).includes("총합")) continue
    const shapeOk = BLOCK_ROWS.every((label, k) => compact(sheet.getCell(r + k, 3)).startsWith(label))
    if (!shapeOk) continue
    // apply는 나중에 호출되므로 블록 시작 행을 따로 고정한다(아래에서 r을 블록 끝으로 옮김).
    const start = r
    targets.push({
      label: normalizeReportLabel(name),
      capacityKw: cellNumber(sheet.getCell(start + 7, 2)),
      apply: (cell) => {
        sheet.getCell(start, c).value = cell.generationKwh ?? 0
        if (cell.irradiance !== null) sheet.getCell(start + 2, c).value = cell.irradiance
        sheet.getCell(start + 3, c).value = cell.smpUnitPrice ?? 0
        sheet.getCell(start + 4, c).value = cell.smpAmount ?? 0
        sheet.getCell(start + 5, c).value = cell.recQuantity ?? 0
        sheet.getCell(start + 6, c).value = cell.recAmount ?? 0
      },
    })
    r += BLOCK_ROWS.length - 1
  }
  if (targets.length === 0) return { ok: false, error: `"${sheet.name}" 시트에서 발전소 블록을 찾지 못했어요.` }
  return { ok: true, kind: "INTEGRATED_BLOCK", targets, warnings: [] }
}

// 3번: "판매금액 기준({연도})" 시트. 회사 행마다 그 달 발전량·판매금액(SMP+REC)을 쓴다.
// Total·발전실적 요약·직전 3년 평균은 수식/기존 값이라 둔다. 검침 시트는 건드리지 않는다.
function detectSalesRows(
  workbook: ExcelJS.Workbook,
  year: string,
  monthNumber: number,
): DetectResult {
  const sheet = workbook.worksheets.find(
    (s) => s.name.includes("판매금액 기준") && s.name.includes(`(${year})`),
  )
  if (!sheet) return { ok: false, error: `"판매금액 기준(${year})" 시트가 없어요. 엑셀에서 시트를 추가한 뒤 다시 올려 주세요.` }

  let headerRow: number | null = null
  let col: number | null = null
  for (let r = 1; r <= 15 && headerRow === null; r++) {
    sheet.getRow(r).eachCell((cell, c) => {
      if (headerRow === null && compact(cell) === `${monthNumber}월`) {
        headerRow = r
        col = c
      }
    })
  }
  if (headerRow === null || col === null) {
    return { ok: false, error: `"${sheet.name}" 시트에서 ${monthNumber}월 머리글을 찾지 못했어요.` }
  }
  const h: number = headerRow
  const c: number = col
  if (compact(sheet.getCell(h + 1, c)) !== "발전량" || compact(sheet.getCell(h + 1, c + 1)) !== "판매금액") {
    return { ok: false, error: `"${sheet.name}" 시트의 ${monthNumber}월 열 구성이 예상(발전량·판매금액)과 달라요.` }
  }

  const targets: ReportTarget[] = []
  for (let r = h + 2; r <= sheet.rowCount; r++) {
    if (compact(sheet.getCell(r, 2)).toLowerCase() === "total") break
    const name = cellText(sheet.getCell(r, 3))
    if (!name.trim()) continue
    targets.push({
      label: normalizeReportLabel(name),
      capacityKw: cellNumber(sheet.getCell(r, 4)),
      apply: (cell) => {
        sheet.getCell(r, c).value = cell.generationKwh ?? 0
        sheet.getCell(r, c + 1).value = cell.totalAmount
      },
    })
  }
  if (targets.length === 0) return { ok: false, error: `"${sheet.name}" 시트에서 회사 행을 찾지 못했어요.` }
  return { ok: true, kind: "SALES_ROW", targets, warnings: [] }
}
