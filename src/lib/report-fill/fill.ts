import "server-only"

import { prisma } from "@/lib/prisma"
import { Prisma } from "@/generated/prisma/client"
import type { BillingStatus } from "@/lib/billing-status"
import { loadRevenueYear, type LedgerPlant } from "@/lib/revenue-ledger"
import {
  REPORT_KIND_LABEL,
  detectReportKind,
  detectTargets,
  loadReportWorkbook,
  saveReportWorkbook,
  type ReportKind,
  type ReportTarget,
} from "./workbook"
import { suggestPlant } from "./match"

export type MappingItem = {
  label: string
  capacityKw: number | null
  suggestedPlantId: number | null
}

export type FillReport = {
  kind: ReportKind
  kindLabel: string
  month: string
  filledCount: number
  statusCounts: Record<BillingStatus, number>
  warnings: string[]
  noData: string[] // 매핑은 됐지만 그 달 앱 데이터가 없는 항목
  skipped: string[] // "해당 없음"으로 저장된 항목
  missingPlants: string[] // 그 달 데이터가 있는데 파일에 자리가 없는 앱 발전소
}

export type FillResult =
  | { status: "error"; error: string }
  | {
      status: "needs_mapping"
      kind: ReportKind
      kindLabel: string
      items: MappingItem[]
      plants: Array<{ id: number; name: string; capacityKw: number | null }>
    }
  | { status: "ok"; report: FillReport; file: Buffer }

// 올라온 제출 엑셀에 고른 귀속월 한 달 값을 채운다.
// 파일 속 이름이 아직 매핑되지 않았으면 채우지 않고 매핑 확인 목록을 돌려준다.
export async function fillReportFile(
  buffer: ArrayBuffer,
  month: string,
  clientGroupId: number,
): Promise<FillResult> {
  let workbook
  try {
    workbook = await loadReportWorkbook(buffer)
  } catch {
    return { status: "error", error: "엑셀 파일(.xlsx)을 읽지 못했어요." }
  }
  const kind = detectReportKind(workbook)
  if (!kind) {
    return { status: "error", error: "1번·2번·3번 매출 보고서 중 어떤 파일인지 알아보지 못했어요." }
  }
  const detected = detectTargets(workbook, kind, month)
  if (!detected.ok) return { status: "error", error: detected.error }

  const [ledger, mappings] = await Promise.all([
    loadRevenueYear(month.slice(0, 4), { clientGroupId }),
    prisma.reportLabelMapping.findMany({
      where: { kind, label: { in: detected.targets.map((t) => t.label) } },
    }),
  ])
  const plantById = new Map(ledger.map((p) => [p.id, p]))
  const mappingByLabel = new Map(mappings.map((m) => [m.label, m.plantId]))

  // 저장된 매핑이 없거나, 다른 거래처 발전소를 가리키는 이름은 확인이 필요하다.
  const unresolved = detected.targets.filter((t) => {
    if (!mappingByLabel.has(t.label)) return true
    const plantId = mappingByLabel.get(t.label)
    return plantId !== null && !plantById.has(plantId!)
  })
  if (unresolved.length > 0) {
    const taken = new Set(
      [...mappingByLabel.values()].filter((id): id is number => id !== null),
    )
    const items = unresolved.map((target) => {
      const suggestedPlantId = suggestPlant(target, ledger, taken)
      if (suggestedPlantId !== null) taken.add(suggestedPlantId)
      return { label: target.label, capacityKw: target.capacityKw, suggestedPlantId }
    })
    return {
      status: "needs_mapping",
      kind,
      kindLabel: REPORT_KIND_LABEL[kind],
      items,
      plants: ledger.map((p) => ({ id: p.id, name: p.name, capacityKw: p.capacityKw })),
    }
  }

  const monthIndex = Number(month.slice(5, 7)) - 1
  const report: FillReport = {
    kind,
    kindLabel: REPORT_KIND_LABEL[kind],
    month,
    filledCount: 0,
    statusCounts: { 미청구: 0, SMP확정: 0, 확정: 0 },
    warnings: [...detected.warnings],
    noData: [],
    skipped: [],
    missingPlants: [],
  }
  const filledPlantIds = new Set<number>()
  for (const target of detected.targets) {
    const plantId = mappingByLabel.get(target.label)
    if (plantId === null || plantId === undefined) {
      report.skipped.push(target.label)
      continue
    }
    const cell = plantById.get(plantId)?.months[monthIndex]
    if (!cell) {
      report.noData.push(target.label)
      continue
    }
    target.apply(cell)
    report.filledCount += 1
    report.statusCounts[cell.status] += 1
    filledPlantIds.add(plantId)
  }
  report.missingPlants = ledger
    .filter((p) => p.months[monthIndex] && !filledPlantIds.has(p.id))
    .map((p) => p.name)

  return { status: "ok", report, file: await saveReportWorkbook(workbook) }
}

// 매핑 확인 화면에서 고른 결과를 저장한다(plantId null = 해당 없음).
// 항목이 수십 개라 upsert를 트랜잭션에 넣으면 원격 DB 왕복이 쌓여 5초 제한을 넘기므로 SQL 한 번으로 쓴다.
export async function saveReportLabelMappings(
  kind: ReportKind,
  items: Array<{ label: string; plantId: number | null }>,
) {
  if (items.length === 0) return
  const values = items.map(
    (item) =>
      Prisma.sql`(${kind}::"report_label_kind", ${item.label}, ${item.plantId}::int, now())`,
  )
  await prisma.$executeRaw`
    INSERT INTO "report_label_mapping" ("kind", "label", "plantId", "updatedAt")
    VALUES ${Prisma.join(values)}
    ON CONFLICT ("kind", "label") DO UPDATE SET
      "plantId" = EXCLUDED."plantId",
      "updatedAt" = EXCLUDED."updatedAt"`
}
