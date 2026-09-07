import "server-only"
import { readFile } from "node:fs/promises"
import path from "node:path"
import * as XLSX from "xlsx"

// 세금계산서 배치 분할과 동일한 10건 기준으로 "차수"를 표시한다(양식지 관행과 통일).
const BATCH_SIZE = 10
const TEMPLATE_PATH = path.resolve(process.cwd(), "양식", "빈양식_월데이.xlsx")
const TEMPLATE_SHEET_NAME = "빈양식"
const HEADER_ROW = 1 // 0-indexed(엑셀 2행). 양식지와 동일하게 1행은 비워둔다.

// 양식지에 실제 적용되어 있던 회계 서식(0은 "-"로 표시) 그대로 재사용.
const ACCOUNTING_INT = '_-* #,##0_-;\\-* #,##0_-;_-* "-"_-;_-@_-'
const ACCOUNTING_2DP = '_-* #,##0.00_-;\\-* #,##0.00_-;_-* "-"_-;_-@_-'

const HEADERS = [
  "차수",
  "번호",
  "발전소명",
  "용량",
  "발전량",
  "발전시간",
  "수평면 일사량",
  "SMP단가",
  "SMP매출",
  "REC수량",
  "REC단가",
  "REC매출",
  "매출총액(A)",
]

export type SmpReportExportRow = {
  plantName: string
  capacityKw: number | null
  generationKwh: number | null
  generationHours: number | null
  irradiance: number | null
  smpUnitPrice: number | null
  supplyAmount: number | null
  recQuantity: number | null
  recUnitPrice: number | null
  recAmount: number | null
  totalAmount: number | null
}

function numOrDash(value: number | null, fmt: string): XLSX.CellObject {
  if (value === null) return { t: "s", v: "-" }
  return { t: "n", v: value, z: fmt }
}

async function loadTemplateColumnWidths(): Promise<XLSX.ColInfo[] | undefined> {
  try {
    const buffer = await readFile(TEMPLATE_PATH)
    const workbook = XLSX.read(buffer, { type: "buffer" })
    return workbook.Sheets[TEMPLATE_SHEET_NAME]?.["!cols"]
  } catch {
    // 양식 파일을 찾지 못해도 열 너비만 기본값으로 내려가고 데이터는 정상 출력한다.
    return undefined
  }
}

// 보고서 모달에 표시된 데이터를 한전 월 데이터 양식지(양식/빈양식_월데이.xlsx)와
// 동일한 컬럼 구성·차수 구분·회계 서식으로 채운 엑셀 파일을 생성한다.
export async function buildSmpReportExportWorkbook(
  rows: SmpReportExportRow[],
): Promise<Buffer> {
  const templateCols = await loadTemplateColumnWidths()

  const sheet: XLSX.WorkSheet = {}
  const merges: XLSX.Range[] = []

  HEADERS.forEach((title, col) => {
    sheet[XLSX.utils.encode_cell({ r: HEADER_ROW, c: col })] = {
      t: "s",
      v: title,
    }
  })

  rows.forEach((row, index) => {
    const r = HEADER_ROW + 1 + index

    if (index % BATCH_SIZE === 0) {
      const batchNo = Math.floor(index / BATCH_SIZE) + 1
      sheet[XLSX.utils.encode_cell({ r, c: 0 })] = { t: "s", v: `${batchNo}차` }
      const groupEndIndex = Math.min(index + BATCH_SIZE, rows.length) - 1
      if (groupEndIndex > index) {
        merges.push({
          s: { r, c: 0 },
          e: { r: HEADER_ROW + 1 + groupEndIndex, c: 0 },
        })
      }
    }

    sheet[XLSX.utils.encode_cell({ r, c: 1 })] = { t: "n", v: index + 1 }
    sheet[XLSX.utils.encode_cell({ r, c: 2 })] = { t: "s", v: row.plantName }
    sheet[XLSX.utils.encode_cell({ r, c: 3 })] = numOrDash(row.capacityKw, "0.00")
    sheet[XLSX.utils.encode_cell({ r, c: 4 })] = numOrDash(
      row.generationKwh,
      ACCOUNTING_INT,
    )
    sheet[XLSX.utils.encode_cell({ r, c: 5 })] = numOrDash(row.generationHours, "0.0")
    sheet[XLSX.utils.encode_cell({ r, c: 6 })] = numOrDash(row.irradiance, "#,##0")
    sheet[XLSX.utils.encode_cell({ r, c: 7 })] = numOrDash(
      row.smpUnitPrice,
      ACCOUNTING_2DP,
    )
    sheet[XLSX.utils.encode_cell({ r, c: 8 })] = numOrDash(
      row.supplyAmount,
      ACCOUNTING_INT,
    )
    sheet[XLSX.utils.encode_cell({ r, c: 9 })] = numOrDash(
      row.recQuantity,
      ACCOUNTING_INT,
    )
    sheet[XLSX.utils.encode_cell({ r, c: 10 })] = numOrDash(
      row.recUnitPrice,
      ACCOUNTING_2DP,
    )
    sheet[XLSX.utils.encode_cell({ r, c: 11 })] = numOrDash(
      row.recAmount,
      ACCOUNTING_INT,
    )
    sheet[XLSX.utils.encode_cell({ r, c: 12 })] = numOrDash(
      row.totalAmount,
      ACCOUNTING_INT,
    )
  })

  // 합계 행 — 보고서 모달 하단의 합계 로직과 동일하게 발전시간/일사량/단가류는 합산하지 않는다.
  const totalRow = HEADER_ROW + 1 + rows.length
  const sum = (pick: (row: SmpReportExportRow) => number | null) =>
    rows.reduce((acc, row) => acc + (pick(row) ?? 0), 0)

  sheet[XLSX.utils.encode_cell({ r: totalRow, c: 0 })] = { t: "s", v: "합  계" }
  merges.push({ s: { r: totalRow, c: 0 }, e: { r: totalRow, c: 2 } })
  sheet[XLSX.utils.encode_cell({ r: totalRow, c: 3 })] = {
    t: "n",
    v: sum((row) => row.capacityKw),
    z: "0.00",
  }
  sheet[XLSX.utils.encode_cell({ r: totalRow, c: 4 })] = {
    t: "n",
    v: sum((row) => row.generationKwh),
    z: ACCOUNTING_INT,
  }
  sheet[XLSX.utils.encode_cell({ r: totalRow, c: 5 })] = { t: "s", v: "-" }
  sheet[XLSX.utils.encode_cell({ r: totalRow, c: 6 })] = { t: "s", v: "-" }
  sheet[XLSX.utils.encode_cell({ r: totalRow, c: 7 })] = { t: "s", v: "-" }
  sheet[XLSX.utils.encode_cell({ r: totalRow, c: 8 })] = {
    t: "n",
    v: sum((row) => row.supplyAmount),
    z: ACCOUNTING_INT,
  }
  sheet[XLSX.utils.encode_cell({ r: totalRow, c: 9 })] = {
    t: "n",
    v: sum((row) => row.recQuantity),
    z: ACCOUNTING_INT,
  }
  sheet[XLSX.utils.encode_cell({ r: totalRow, c: 10 })] = { t: "s", v: "-" }
  sheet[XLSX.utils.encode_cell({ r: totalRow, c: 11 })] = {
    t: "n",
    v: sum((row) => row.recAmount),
    z: ACCOUNTING_INT,
  }
  sheet[XLSX.utils.encode_cell({ r: totalRow, c: 12 })] = {
    t: "n",
    v: sum((row) => row.totalAmount),
    z: ACCOUNTING_INT,
  }

  sheet["!ref"] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: totalRow, c: 12 },
  })
  sheet["!merges"] = merges
  if (templateCols) sheet["!cols"] = templateCols
  sheet["!rows"] = Array.from({ length: totalRow + 1 }, () => ({ hpt: 21 }))

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, TEMPLATE_SHEET_NAME)
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer
}
