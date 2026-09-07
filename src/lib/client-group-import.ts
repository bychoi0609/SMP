import "server-only"
import * as XLSX from "xlsx"

// 거래처 일괄 업로드용 엑셀 컬럼 순서 — 샘플 다운로드와 업로드 파싱이 항상 같은 순서를 쓴다.
export const CLIENT_GROUP_IMPORT_HEADERS = [
  "거래처명",
  "정식 상호(세금계산서용)",
  "사업자등록번호",
  "대표자(성명)",
  "사업장주소",
  "업태",
  "종목",
  "이메일",
] as const

export const CLIENT_GROUP_SAMPLE_ROW = [
  "키스트론",
  "키스트론 주식회사",
  "5068113147",
  "신재명 외 1 명",
  "경기도 안산시 단원구 산단로68번길 37(원시동)",
  "제조업",
  "태양광발전사업",
  "sch13147@kiswire.com",
]

export type ClientGroupImportRow = {
  name: string
  legalName: string | null
  bizNumber: string
  ceoName: string
  address: string | null
  bizType: string | null
  bizItem: string | null
  email: string | null
}

function cell(row: unknown[], idx: number): string {
  const value = row[idx]
  return value === null || value === undefined ? "" : String(value).trim()
}

// 업로드된 엑셀 버퍼를 파싱해 유효한 행과, 필수값이 빠져 건너뛴 행 수를 함께 반환한다.
export function parseClientGroupExcel(buffer: Buffer): {
  rows: ClientGroupImportRow[]
  skipped: number
} {
  const workbook = XLSX.read(buffer, { type: "buffer" })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
  })

  const rows: ClientGroupImportRow[] = []
  let skipped = 0

  // 1행은 헤더로 간주하고 건너뛴다.
  for (const row of raw.slice(1)) {
    if (!row.length || row.every((v) => String(v).trim() === "")) continue

    const name = cell(row, 0)
    const bizNumber = cell(row, 2)
    const ceoName = cell(row, 3)

    if (!name || !bizNumber || !ceoName) {
      skipped++
      continue
    }

    rows.push({
      name,
      legalName: cell(row, 1) || null,
      bizNumber,
      ceoName,
      address: cell(row, 4) || null,
      bizType: cell(row, 5) || null,
      bizItem: cell(row, 6) || null,
      email: cell(row, 7) || null,
    })
  }

  return { rows, skipped }
}

export function buildClientGroupSampleWorkbook(): Buffer {
  const aoa = [[...CLIENT_GROUP_IMPORT_HEADERS], CLIENT_GROUP_SAMPLE_ROW]
  const sheet = XLSX.utils.aoa_to_sheet(aoa)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, "거래처 업로드")
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer
}
