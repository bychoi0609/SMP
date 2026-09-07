import "server-only"
import * as XLSX from "xlsx"

import { IRRADIANCE_REGIONS, isIrradianceRegion } from "@/lib/irradiance-regions"

// 발전소 일괄 업로드용 엑셀 컬럼 순서 — 샘플 다운로드와 업로드 파싱이 항상 같은 순서를 쓴다.
export const PLANT_IMPORT_HEADERS = [
  "발전소명",
  "발전소 별칭(비고용)",
  "계약번호(비우면 전력거래소 발전소)",
  "종사업장번호(전력거래소 발전소는 비워도 됨)",
  "한전 담당 이메일",
  "주소",
  "용량(kW)",
  `수평면 일사량 지역(${IRRADIANCE_REGIONS.join("/")} 중 선택, 비워도 됨)`,
  "건설순서(비우면 자동 배정)",
  "거래처명(등록된 거래처와 동일해야 함)",
] as const

export const PLANT_SAMPLE_ROW = [
  "예시 태양광발전소",
  "예시",
  "5000000000",
  "251",
  "ppa0251@kepco.co.kr",
  "경기도 안산시 단원구 산단로68번길 37",
  "100",
  "경주",
  "",
  "키스트론",
]

export type PlantImportRow = {
  plantName: string
  plantAlias: string | null
  // 비어 있으면 한국전력거래소(KPX)와 SMP계약이 된 발전소로 인식한다.
  contractNumber: string | null
  // 한전 종사업장 개념이라 한국전력거래소(KPX) 발전소는 없을 수 있다.
  subBizNumber: string | null
  kepcoContactEmail: string | null
  address: string | null
  capacityKw: number | null
  // 수평면 일사량 매칭 기준 지역 (IRRADIANCE_REGIONS 중 하나, 없으면 null).
  irradianceRegion: string | null
  constructionOrder: number | null
  clientGroupName: string
}

export type PlantImportRowError = {
  rowNumber: number // 엑셀 상 행 번호(1행=헤더)
  reason: string
}

function cell(row: unknown[], idx: number): string {
  const value = row[idx]
  return value === null || value === undefined ? "" : String(value).trim()
}

function toNumberOrNull(value: string): number | null {
  if (value === "") return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export function parsePlantExcel(buffer: Buffer): {
  rows: PlantImportRow[]
  errors: PlantImportRowError[]
} {
  const workbook = XLSX.read(buffer, { type: "buffer" })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
  })

  const rows: PlantImportRow[] = []
  const errors: PlantImportRowError[] = []

  raw.slice(1).forEach((row, idx) => {
    const rowNumber = idx + 2 // 1행은 헤더
    if (!row.length || row.every((v) => String(v).trim() === "")) return

    const plantName = cell(row, 0)
    const contractNumber = cell(row, 2)
    const subBizNumber = cell(row, 3)
    const irradianceRegion = cell(row, 7)
    const clientGroupName = cell(row, 9)

    if (!plantName || !clientGroupName) {
      errors.push({
        rowNumber,
        reason: "필수값(발전소명/거래처명) 누락으로 건너뜀",
      })
      return
    }

    // 계약번호가 있는(한전) 발전소는 종사업장번호가 필수다. 계약번호가 없는
    // 전력거래소(KPX) 발전소는 한전 종사업장 개념이 없어 비워둘 수 있다.
    if (contractNumber && !subBizNumber) {
      errors.push({
        rowNumber,
        reason: "계약번호가 있는 발전소는 종사업장번호가 필수입니다 (누락으로 건너뜀)",
      })
      return
    }

    if (irradianceRegion && !isIrradianceRegion(irradianceRegion)) {
      errors.push({
        rowNumber,
        reason: `수평면 일사량 지역 값이 올바르지 않습니다(${IRRADIANCE_REGIONS.join("/")} 중 선택, 누락으로 건너뜀)`,
      })
      return
    }

    rows.push({
      plantName,
      plantAlias: cell(row, 1) || null,
      // 비어 있으면 한국전력거래소(KPX) 발전소로 인식한다.
      contractNumber: contractNumber || null,
      subBizNumber: subBizNumber || null,
      kepcoContactEmail: cell(row, 4) || null,
      address: cell(row, 5) || null,
      capacityKw: toNumberOrNull(cell(row, 6)),
      irradianceRegion: irradianceRegion || null,
      constructionOrder: toNumberOrNull(cell(row, 8)),
      clientGroupName,
    })
  })

  return { rows, errors }
}

export function buildPlantSampleWorkbook(): Buffer {
  const aoa = [[...PLANT_IMPORT_HEADERS], PLANT_SAMPLE_ROW]
  const sheet = XLSX.utils.aoa_to_sheet(aoa)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, "발전소 업로드")
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer
}

export type PlantExportRow = PlantImportRow

// 등록된 발전소 목록을 업로드 양식과 동일한 컬럼 순서로 내보낸다 —
// 다운로드한 파일을 그대로 수정해 재업로드할 수 있도록 헤더를 맞춘다.
export function buildPlantExportWorkbook(rows: PlantExportRow[]): Buffer {
  const aoa = [
    [...PLANT_IMPORT_HEADERS],
    ...rows.map((row) => [
      row.plantName,
      row.plantAlias ?? "",
      row.contractNumber ?? "",
      row.subBizNumber ?? "",
      row.kepcoContactEmail ?? "",
      row.address ?? "",
      row.capacityKw ?? "",
      row.irradianceRegion ?? "",
      row.constructionOrder ?? "",
      row.clientGroupName,
    ]),
  ]
  const sheet = XLSX.utils.aoa_to_sheet(aoa)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, "발전소 목록")
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer
}
