// 매출 숫자 계산 규칙(REC 수량·금액, 발전시간, SMP단가). SMP·REC 표(클라이언트)와
// 매출 현황·발전소 원장(서버)이 모두 이 함수로 계산해 화면마다 숫자가 같게 한다.
import { daysInMonth } from "@/lib/date"
import { estimateRecQuantity } from "@/lib/rec-quantity"
import { getSmpContractType } from "@/lib/smp-contract-type"
import type { ReportPlant, ReportRow } from "@/app/smp/actions"

export function emptyReportRow(plantId: number): ReportRow {
  return {
    plantId,
    generationKwh: null,
    smpUnitPrice: null,
    supplyAmount: null,
    recQuantity: null,
    recUnitPrice: null,
    recAmount: null,
    recStatus: null,
    recQuantityIsActual: false,
    recUnitPriceIsManual: false,
    capacityKw: null,
  }
}

// 화면에 보여줄 REC수량. 실제 발급량을 입력했거나(recQuantityIsActual) 행이
// 확정됐으면 저장된 수량을 그대로 쓴다. 그 외에는 대표단가 적용 등으로 자동
// 채워진 값일 뿐이므로, 가중치/발전량이 바뀌면 계속 최신 예상치로 다시 계산한다.
// (서버의 loadRecTargets도 같은 규칙을 따른다.)
export function isRecQuantityFixed(row: ReportRow | undefined): boolean {
  return !!row && (row.recQuantityIsActual || row.recStatus === "CONFIRMED")
}

export function getDisplayRecQuantity(
  plant: ReportPlant,
  row: ReportRow | undefined,
): number | null {
  if (row && isRecQuantityFixed(row) && row.recQuantity !== null) {
    return row.recQuantity
  }
  if (row?.generationKwh === null || row?.generationKwh === undefined) {
    return null
  }
  return estimateRecQuantity(row.generationKwh, plant.recWeight)
}

// REC매출 = 같은 행의 REC수량(확정 또는 예상치) × REC단가. 단가가 아직
// 입력되지 않았으면 매출도 미확정 상태이므로 표시하지 않는다.
export function getDisplayRecAmount(
  plant: ReportPlant,
  row: ReportRow | undefined,
): number | null {
  const quantity = getDisplayRecQuantity(plant, row)
  if (
    quantity === null ||
    row?.recUnitPrice === null ||
    row?.recUnitPrice === undefined
  ) {
    return null
  }
  return quantity * row.recUnitPrice
}

// 해당 월 계산에 쓰는 설비용량. 월 데이터에 저장된 당시 용량(스냅샷)을 우선하고,
// 아직 월 데이터가 없으면 발전소의 현재 용량을 쓴다.
export function getRowCapacity(
  plant: ReportPlant,
  row: ReportRow | undefined,
): number | null {
  return row?.capacityKw ?? plant.capacityKw
}

// 발전량과 용량으로부터 해당 월의 일평균 발전시간을 구한다.
export function getGenerationHours(
  capacityKw: number | null,
  generationKwh: number | null,
  month: string,
): number | null {
  if (generationKwh === null || !capacityKw) return null
  return generationKwh / capacityKw / daysInMonth(month)
}

// 한국전력거래소(KPX)와 SMP계약된 발전소는 SMP단가를 직접 입력하지 않고
// 같은 행의 발전량·SMP매출로부터 역산한다.
export function getEffectiveSmpUnitPrice(
  plant: ReportPlant,
  row: ReportRow | undefined,
  generationKwh: number | null,
): number | null {
  const isKpxContract = getSmpContractType(plant.contractNumber) === "KPX"
  if (isKpxContract) {
    return generationKwh ? (row?.supplyAmount ?? 0) / generationKwh : null
  }
  return row?.smpUnitPrice ?? null
}
