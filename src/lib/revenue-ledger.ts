import "server-only"

import { prisma } from "@/lib/prisma"
import type { Prisma } from "@/generated/prisma/client"
import { daysInMonth } from "@/lib/date"
import {
  computeBillingStatus,
  isRecSettled,
  smpConfirmationKey,
  type BillingStatus,
} from "@/lib/billing-status"
import { getConfirmedSmpKeys } from "@/lib/billing-status-server"
import { REPORT_PLANT_SELECT, toReportPlant } from "@/lib/report-plant"
import {
  getDisplayRecAmount,
  getDisplayRecQuantity,
  getEffectiveSmpUnitPrice,
  getGenerationHours,
  getRowCapacity,
  isRecQuantityFixed,
} from "@/lib/revenue-calc"
import type { ReportPlant, ReportRow } from "@/app/smp/actions"

// 매출 현황·발전소 원장(1번 엑셀 발전소 시트)의 한 달 값.
export type LedgerCell = {
  month: string // YYYY-MM
  capacityKw: number | null
  generationKwh: number | null
  generationHours: number | null
  irradiance: number | null // 수평면일사량(발전소 지역 기준, 미입력이면 null)
  smpUnitPrice: number | null
  smpAmount: number | null
  recQuantity: number | null
  recQuantityIsEstimate: boolean
  recAmount: number | null // 단가가 아직 없으면 null (엑셀 중순본처럼 비움)
  totalAmount: number
  status: BillingStatus
}

// 여러 달(발전소 연간) 또는 여러 발전소(월 합계)를 묶은 값.
export type LedgerSummary = {
  generationKwh: number
  generationHours: number | null
  irradiance: number | null
  smpUnitPrice: number | null
  smpAmount: number
  recQuantity: number
  recAmount: number
  totalAmount: number
  status: BillingStatus | null // 묶인 값 중 가장 덜 진행된 상태
  count: number
}

export type LedgerPlant = {
  id: number
  name: string // 별칭 우선
  plantName: string
  capacityKw: number | null
  irradianceRegion: string | null
  contractPhase: number | null
  constructionOrder: number
  clientGroupId: number
  clientGroupName: string
  operatingStatus: ReportPlant["operatingStatus"]
  recWeight: number
  months: (LedgerCell | null)[] // 1~12월, 데이터 없는 달은 null
  year: LedgerSummary
}

const STATUS_ORDER: BillingStatus[] = ["미청구", "SMP확정", "확정"]

function leastStatus(statuses: BillingStatus[]): BillingStatus | null {
  if (statuses.length === 0) return null
  return statuses.reduce((a, b) =>
    STATUS_ORDER.indexOf(a) <= STATUS_ORDER.indexOf(b) ? a : b,
  )
}

function average(values: (number | null)[]): number | null {
  const nums = values.filter((v): v is number => v !== null)
  return nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : null
}

function sumOf(cells: LedgerCell[], pick: (c: LedgerCell) => number | null) {
  return cells.reduce((acc, c) => acc + (pick(c) ?? 0), 0)
}

// 한 발전소의 기간(연간·반기) 합계. 발전시간·SMP단가는 데이터가 있는 달의 평균
// (1번 엑셀 26년 시트 방식), 일사량과 나머지는 합계(2번 엑셀과 동일).
export function summarizeMonths(cells: (LedgerCell | null)[]): LedgerSummary {
  const filled = cells.filter((c): c is LedgerCell => c !== null)
  const irradiance = filled.filter((c) => c.irradiance !== null)
  return {
    generationKwh: sumOf(filled, (c) => c.generationKwh),
    generationHours: average(filled.map((c) => c.generationHours)),
    irradiance: irradiance.length > 0 ? sumOf(irradiance, (c) => c.irradiance) : null,
    smpUnitPrice: average(filled.map((c) => c.smpUnitPrice)),
    smpAmount: sumOf(filled, (c) => c.smpAmount),
    recQuantity: sumOf(filled, (c) => c.recQuantity),
    recAmount: sumOf(filled, (c) => c.recAmount),
    totalAmount: sumOf(filled, (c) => c.totalAmount),
    status: leastStatus(filled.map((c) => c.status)),
    count: filled.length,
  }
}

// 같은 달 여러 발전소의 합계. 발전시간은 합계 발전량 ÷ 합계 용량 ÷ 일수,
// SMP단가는 합계 SMP금액 ÷ 합계 발전량(REC 탭 합계 줄과 같은 방식), 일사량은 평균.
export function summarizePlants(cells: (LedgerCell | null)[]): LedgerSummary {
  const filled = cells.filter((c): c is LedgerCell => c !== null)
  const generationKwh = sumOf(filled, (c) => c.generationKwh)
  const smpAmount = sumOf(filled, (c) => c.smpAmount)
  const capacity = sumOf(
    filled.filter((c) => c.generationKwh !== null),
    (c) => c.capacityKw,
  )
  const month = filled[0]?.month
  return {
    generationKwh,
    generationHours:
      month && capacity > 0 ? generationKwh / capacity / daysInMonth(month) : null,
    irradiance: average(filled.map((c) => c.irradiance)),
    smpUnitPrice: generationKwh > 0 ? smpAmount / generationKwh : null,
    smpAmount,
    recQuantity: sumOf(filled, (c) => c.recQuantity),
    recAmount: sumOf(filled, (c) => c.recAmount),
    totalAmount: sumOf(filled, (c) => c.totalAmount),
    status: leastStatus(filled.map((c) => c.status)),
    count: filled.length,
  }
}

// 여러 발전소의 기간(연간·반기) 합계 칸. 월 합계들을 받아, 발전시간·SMP단가는
// 월 값들의 평균으로 발전소 행의 기간 규칙과 맞추고 일사량은 합계로 둔다.
export function summarizeYearTotal(monthTotals: LedgerSummary[]): LedgerSummary {
  const filled = monthTotals.filter((m) => m.count > 0)
  const sum = (pick: (m: LedgerSummary) => number) =>
    filled.reduce((acc, m) => acc + pick(m), 0)
  return {
    generationKwh: sum((m) => m.generationKwh),
    generationHours: average(filled.map((m) => m.generationHours)),
    irradiance: filled.some((m) => m.irradiance !== null)
      ? sum((m) => m.irradiance ?? 0)
      : null,
    smpUnitPrice: average(filled.map((m) => m.smpUnitPrice)),
    smpAmount: sum((m) => m.smpAmount),
    recQuantity: sum((m) => m.recQuantity),
    recAmount: sum((m) => m.recAmount),
    totalAmount: sum((m) => m.totalAmount),
    status: leastStatus(
      filled.map((m) => m.status).filter((s): s is BillingStatus => s !== null),
    ),
    count: sum((m) => m.count),
  }
}

function buildCell(
  plant: ReportPlant,
  row: ReportRow,
  month: string,
  status: BillingStatus,
  irradiance: number | null,
): LedgerCell {
  const capacityKw = getRowCapacity(plant, row)
  const recAmount = getDisplayRecAmount(plant, row)
  const smpAmount = row.supplyAmount
  return {
    month,
    capacityKw,
    generationKwh: row.generationKwh,
    generationHours: getGenerationHours(capacityKw, row.generationKwh, month),
    irradiance,
    smpUnitPrice: getEffectiveSmpUnitPrice(plant, row, row.generationKwh),
    smpAmount,
    recQuantity: getDisplayRecQuantity(plant, row),
    recQuantityIsEstimate: !isRecQuantityFixed(row) && row.generationKwh !== null,
    recAmount,
    totalAmount: (smpAmount ?? 0) + (recAmount ?? 0),
    status,
  }
}

// SMP 데이터가 있는 연도 목록(최신순).
export async function getRevenueYears(): Promise<string[]> {
  const rows = await prisma.smpMonthly.findMany({
    where: { parseStatus: "OK", plantId: { not: null } },
    distinct: ["billingYearMonth"],
    select: { billingYearMonth: true },
  })
  return [...new Set(rows.map((r) => r.billingYearMonth.slice(0, 4)))].sort((a, b) =>
    b.localeCompare(a),
  )
}

// 한 해의 발전소별 월 매출 원장. plantWhere로 거래처·검색·특정 발전소를 좁힌다.
// 폐지 발전소는 그 해 데이터가 있을 때만 포함한다.
export async function loadRevenueYear(
  year: string,
  plantWhere: Prisma.PlantMasterWhereInput = {},
): Promise<LedgerPlant[]> {
  const yearPrefix = `${year}-`
  const plants = await prisma.plantMaster.findMany({
    where: {
      AND: [
        plantWhere,
        {
          OR: [
            { operatingStatus: { not: "CLOSED" } },
            {
              smpMonthlies: {
                some: { billingYearMonth: { startsWith: yearPrefix } },
              },
            },
          ],
        },
      ],
    },
    orderBy: { constructionOrder: "asc" },
    select: {
      ...REPORT_PLANT_SELECT,
      contractPhase: true,
      constructionOrder: true,
      clientGroupId: true,
      clientGroup: { select: { name: true } },
    },
  })
  const plantIds = plants.map((p) => p.id)

  const [smpRows, recRows, confirmedSmpKeys, irradianceRows] = await Promise.all([
    prisma.smpMonthly.findMany({
      where: {
        plantId: { in: plantIds },
        parseStatus: "OK",
        billingYearMonth: { startsWith: yearPrefix },
      },
    }),
    prisma.recMonthly.findMany({
      where: {
        plantId: { in: plantIds },
        billingYearMonth: { startsWith: yearPrefix },
      },
    }),
    getConfirmedSmpKeys(),
    prisma.solarIrradianceMonthly.findMany({
      where: { billingYearMonth: { startsWith: yearPrefix } },
    }),
  ])
  const irradianceByKey = new Map(
    irradianceRows.map((r) => [`${r.region}-${r.billingYearMonth}`, Number(r.value)]),
  )

  const recByKey = new Map(
    recRows.map((r) => [`${r.plantId}-${r.billingYearMonth}`, r]),
  )
  const smpByPlant = new Map<number, typeof smpRows>()
  for (const row of smpRows) {
    const list = smpByPlant.get(row.plantId!) ?? []
    list.push(row)
    smpByPlant.set(row.plantId!, list)
  }

  return plants.map((p) => {
    const plant = toReportPlant(p)
    const months: (LedgerCell | null)[] = Array(12).fill(null)

    for (const smp of smpByPlant.get(p.id) ?? []) {
      const month = smp.billingYearMonth
      const rec = recByKey.get(`${p.id}-${month}`)
      const row: ReportRow = {
        plantId: p.id,
        generationKwh: smp.generationKwh ? Number(smp.generationKwh) : null,
        smpUnitPrice: smp.smpUnitPrice ? Number(smp.smpUnitPrice) : null,
        supplyAmount: smp.supplyAmount ? Number(smp.supplyAmount) : null,
        recQuantity: rec ? Number(rec.quantity) : null,
        recUnitPrice: rec ? Number(rec.unitPrice) : null,
        recAmount: rec ? Number(rec.amount) : null,
        recStatus: rec ? rec.status : null,
        recQuantityIsActual: rec?.quantityIsActual ?? false,
        recUnitPriceIsManual: rec?.unitPriceIsManual ?? false,
        capacityKw: smp.capacityKw ? Number(smp.capacityKw) : null,
      }
      const status = computeBillingStatus(
        confirmedSmpKeys.has(smpConfirmationKey(p.clientGroupId, month)),
        isRecSettled(
          rec && {
            status: rec.status,
            quantity: Number(rec.quantity),
            unitPrice: Number(rec.unitPrice),
          },
        ),
      )
      const irradiance = p.irradianceRegion
        ? (irradianceByKey.get(`${p.irradianceRegion}-${month}`) ?? null)
        : null
      months[Number(month.slice(5, 7)) - 1] = buildCell(plant, row, month, status, irradiance)
    }

    return {
      id: p.id,
      name: p.plantAlias ?? p.plantName,
      plantName: p.plantName,
      capacityKw: plant.capacityKw,
      irradianceRegion: p.irradianceRegion,
      contractPhase: p.contractPhase,
      constructionOrder: p.constructionOrder,
      clientGroupId: p.clientGroupId,
      clientGroupName: p.clientGroup.name,
      operatingStatus: p.operatingStatus,
      recWeight: plant.recWeight,
      months,
      year: summarizeMonths(months),
    }
  })
}
