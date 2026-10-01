import Link from "next/link"
import { FileBarChart } from "lucide-react"

import { Button } from "@/components/ui/button"

import { ClientGroupFilterBar } from "@/components/client-group-filter-bar"
import { prisma } from "@/lib/prisma"
import type { Prisma } from "@/generated/prisma/client"
import { cn } from "@/lib/utils"
import {
  getRevenueYears,
  loadRevenueYear,
  summarizePlants,
  summarizeYearTotal,
  type LedgerPlant,
  type LedgerSummary,
} from "@/lib/revenue-ledger"
import { formatNumber } from "@/lib/format"
import { REVENUE_METRICS, isRevenueMetric, type RevenueMetric } from "./metrics"
import { ParamSelect } from "./param-select"
import { PlantPicker } from "./plant-picker"
import { statusTextClass, StatusLegend } from "./status-style"

const MONTHS = Array.from({ length: 12 }, (_, i) => i)

const th =
  "border-b border-r border-border bg-muted px-3 py-2.5 text-center text-sm font-medium whitespace-nowrap"
const td = "border-b border-r border-border px-3 py-2 text-right text-sm tabular-nums whitespace-nowrap"
// 발전소 이름 열은 가로 스크롤해도 고정
const stickyCol = "sticky left-0 z-[1]"

type PlantGroup = { key: string; label: string | null; plants: LedgerPlant[] }

// 계약차수가 하나라도 입력돼 있으면 차수별로 묶고, 없으면 한 묶음으로 보여준다.
function groupByPhase(plants: LedgerPlant[]): PlantGroup[] {
  if (!plants.some((p) => p.contractPhase !== null)) {
    return [{ key: "all", label: null, plants }]
  }
  const byPhase = new Map<number | null, LedgerPlant[]>()
  for (const plant of plants) {
    const list = byPhase.get(plant.contractPhase) ?? []
    list.push(plant)
    byPhase.set(plant.contractPhase, list)
  }
  return [...byPhase.entries()]
    .sort(([a], [b]) => (a ?? Infinity) - (b ?? Infinity))
    .map(([phase, list]) => ({
      key: String(phase),
      label: phase === null ? "차수 미지정" : `${phase}차`,
      plants: list,
    }))
}

type Totals = { months: LedgerSummary[]; year: LedgerSummary; capacityKw: number }

function totalsOf(plants: LedgerPlant[]): Totals {
  const months = MONTHS.map((i) => summarizePlants(plants.map((p) => p.months[i])))
  return {
    months,
    year: summarizeYearTotal(months),
    capacityKw: plants.reduce((acc, p) => acc + (p.capacityKw ?? 0), 0),
  }
}

function omit(params: Record<string, string>, ...keys: string[]) {
  return Object.fromEntries(Object.entries(params).filter(([k]) => !keys.includes(k)))
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; client?: string; q?: string; metric?: string }>
}) {
  const {
    year: yearParam,
    client: clientParam,
    q: qParam,
    metric: metricParam,
  } = await searchParams
  const clientGroupId = clientParam ? Number(clientParam) : undefined
  const query = qParam?.trim() || undefined
  const metricKey: RevenueMetric = isRevenueMetric(metricParam) ? metricParam : "total"
  const metric = REVENUE_METRICS[metricKey]

  const years = await getRevenueYears()
  const year =
    yearParam && years.includes(yearParam)
      ? yearParam
      : (years[0] ?? String(new Date().getFullYear()))

  const plantWhere: Prisma.PlantMasterWhereInput = {}
  if (clientGroupId) plantWhere.clientGroupId = clientGroupId
  if (query) {
    plantWhere.OR = [
      { plantName: { contains: query } },
      { plantAlias: { contains: query } },
    ]
  }

  const [ledger, clientGroups] = await Promise.all([
    loadRevenueYear(year, plantWhere),
    prisma.clientGroup.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ])
  const groups = groupByPhase(ledger)
  const grandTotal = totalsOf(ledger)
  const hasData = grandTotal.year.count > 0

  // 다른 필터를 바꿀 때 유지할 쿼리
  const baseParams: Record<string, string> = {
    year,
    metric: metricKey,
    ...(clientParam ? { client: clientParam } : {}),
    ...(qParam ? { q: qParam } : {}),
  }

  const plantLink = (id: number) =>
    `/reports/plants/${id}?${new URLSearchParams({
      year,
      ...(clientParam ? { client: clientParam } : {}),
    }).toString()}`

  function renderValue(value: LedgerSummary | null | undefined) {
    if (!value || value.count === 0) return "-"
    return metric.format(metric.pick(value))
  }

  function renderTotalRow(label: string, totals: Totals, strong: boolean) {
    const cellClass = cn(td, strong ? "bg-muted font-semibold" : "bg-muted/50 font-medium")
    return (
      <tr>
        <td className={cn(cellClass, stickyCol, "text-left")} colSpan={2}>
          {label}
        </td>
        <td className={cellClass}>{formatNumber(totals.capacityKw, 2)}</td>
        {totals.months.map((m, i) => (
          <td key={i} className={cn(cellClass, m.status && statusTextClass(m.status))}>
            {renderValue(m)}
          </td>
        ))}
        <td className={cellClass}>{renderValue(totals.year)}</td>
      </tr>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">매출 현황</h1>
          <p className="text-sm text-muted-foreground">
            발전소별 월 매출을 한눈에 봐요. 발전소 이름을 누르면 1번 매출
            보고서와 같은 월별 원장이 열려요.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PlantPicker
            plants={ledger.map((p) => ({ id: p.id, label: p.name }))}
            year={year}
          />
          <Button
            variant="outline"
            size="sm"
            render={
              <Link
                href={`/reports/performance?${new URLSearchParams({
                  year,
                  ...(clientParam ? { client: clientParam } : {}),
                }).toString()}`}
              />
            }
          >
            <FileBarChart /> 실적 보고서
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ParamSelect
          basePath="/reports"
          name="year"
          value={year}
          options={(years.length > 0 ? years : [year]).map((y) => ({
            value: y,
            label: `${y}년`,
          }))}
          params={omit(baseParams, "year")}
          className="w-28"
        />
        <ParamSelect
          basePath="/reports"
          name="metric"
          value={metricKey}
          options={Object.entries(REVENUE_METRICS).map(([value, m]) => ({
            value,
            label: `${m.label} (${m.unit})`,
          }))}
          params={omit(baseParams, "metric")}
          className="w-40"
        />
        <ClientGroupFilterBar
          basePath="/reports"
          clientGroups={clientGroups}
          selectedClientGroupId={clientGroupId}
          query={qParam}
          extraParams={omit(baseParams, "client", "q")}
        />
      </div>

      {!hasData ? (
        <div className="rounded-xl border p-8 text-center text-sm text-muted-foreground">
          {year}년에 집계할 SMP 데이터가 없어요. SMP 메뉴에서 메일을 먼저
          수집해 주세요.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <StatusLegend />
          <div className="max-h-[75vh] overflow-auto rounded-xl border bg-card">
            <table className="w-full min-w-[1400px] border-separate border-spacing-0">
              <thead className="sticky top-0 z-10">
                <tr>
                  <th className={cn(th, stickyCol, "z-20 w-12")}>번호</th>
                  <th className={cn(th, "sticky left-12 z-20 w-48 text-left")}>발전소</th>
                  <th className={cn(th, "w-20")}>용량(kW)</th>
                  {MONTHS.map((i) => (
                    <th key={i} className={cn(th, "w-28")}>
                      {i + 1}월
                    </th>
                  ))}
                  <th className={cn(th, "w-32")}>
                    연간{metricKey === "hours" ? "(평균)" : ""}
                  </th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <PlantGroupRows
                    key={group.key}
                    group={group}
                    showSubtotal={groups.length > 1}
                    renderTotalRow={renderTotalRow}
                    totals={totalsOf(group.plants)}
                    rowStart={ledger.indexOf(group.plants[0])}
                    plantLink={plantLink}
                    renderCell={(plant, i) => {
                      const cell = plant.months[i]
                      return (
                        <td
                          key={i}
                          className={cn(td, cell && statusTextClass(cell.status))}
                          title={cell ? `${cell.month} · ${cell.status}` : undefined}
                        >
                          {cell ? metric.format(metric.pick(cell)) : "-"}
                        </td>
                      )
                    }}
                    renderYear={(plant) => (
                      <td className={cn(td, "font-medium")}>{renderValue(plant.year)}</td>
                    )}
                  />
                ))}
              </tbody>
              <tfoot className="sticky bottom-0 z-10">
                {renderTotalRow("전체 합계", grandTotal, true)}
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function PlantGroupRows({
  group,
  showSubtotal,
  totals,
  rowStart,
  plantLink,
  renderCell,
  renderYear,
  renderTotalRow,
}: {
  group: PlantGroup
  showSubtotal: boolean
  totals: Totals
  rowStart: number
  plantLink: (id: number) => string
  renderCell: (plant: LedgerPlant, monthIndex: number) => React.ReactNode
  renderYear: (plant: LedgerPlant) => React.ReactNode
  renderTotalRow: (
    label: string,
    totals: Totals,
    strong: boolean,
  ) => React.ReactNode
}) {
  return (
    <>
      {group.label && (
        <tr>
          <td
            colSpan={16}
            className="border-b border-border bg-accent/40 px-3 py-1.5 text-left text-sm font-semibold"
          >
            {group.label}
          </td>
        </tr>
      )}
      {group.plants.map((plant, index) => (
        <tr key={plant.id} className="hover:bg-accent/30">
          <td className={cn(td, stickyCol, "bg-card text-center")}>{rowStart + index + 1}</td>
          <td className={cn(td, "sticky left-12 z-[1] bg-card text-left font-medium")}>
            <Link href={plantLink(plant.id)} className="hover:underline">
              {plant.name}
            </Link>
            {plant.operatingStatus !== "ACTIVE" && (
              <span className="ml-1 text-xs text-muted-foreground">
                ({plant.operatingStatus === "CLOSED" ? "폐지" : "정지"})
              </span>
            )}
          </td>
          <td className={td}>{formatNumber(plant.capacityKw, 2)}</td>
          {MONTHS.map((i) => renderCell(plant, i))}
          {renderYear(plant)}
        </tr>
      ))}
      {showSubtotal && renderTotalRow(`${group.label} 소계`, totals, false)}
    </>
  )
}
