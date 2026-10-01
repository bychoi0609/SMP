import Link from "next/link"
import { Table2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { prisma } from "@/lib/prisma"
import { formatAmount, formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"
import {
  getRevenueYears,
  loadRevenueYear,
  summarizeMonths,
  summarizePlants,
  summarizeYearTotal,
  type LedgerCell,
  type LedgerPlant,
  type LedgerSummary,
} from "@/lib/revenue-ledger"
import { ParamSelect } from "../param-select"
import { statusTextClass, StatusLegend } from "../status-style"

// 2번 엑셀(매출 보고서_통합(확정본)) 배치: 1~6월 · 상반기 · 7~12월 · 하반기 · 연간
type Column =
  | { kind: "month"; index: number; label: string }
  | { kind: "period"; from: number; to: number; label: string }

const COLUMNS: Column[] = [
  ...Array.from({ length: 6 }, (_, i) => ({ kind: "month" as const, index: i, label: `${i + 1}월` })),
  { kind: "period", from: 0, to: 6, label: "상반기" },
  ...Array.from({ length: 6 }, (_, i) => ({ kind: "month" as const, index: i + 6, label: `${i + 7}월` })),
  { kind: "period", from: 6, to: 12, label: "하반기" },
  { kind: "period", from: 0, to: 12, label: "연간" },
]

type Value = LedgerCell | LedgerSummary

// 발전소·총합 블록의 8줄
const ROWS: Array<{
  key: string
  label: (region: string | null) => string
  pick: (v: Value) => number | null
  format: (n: number | null) => string
}> = [
  { key: "gen", label: () => "발전량", pick: (v) => v.generationKwh, format: (n) => formatAmount(n === null ? null : Math.round(n)) },
  { key: "hours", label: () => "발전시간", pick: (v) => v.generationHours, format: (n) => formatNumber(n, 2) },
  {
    key: "irr",
    label: (region) => (region ? `수평면일사량(${region})` : "수평면일사량"),
    pick: (v) => v.irradiance,
    format: (n) => formatNumber(n, 0),
  },
  { key: "smpPrice", label: () => "SMP단가", pick: (v) => v.smpUnitPrice, format: (n) => formatNumber(n, 2) },
  { key: "smp", label: () => "SMP매출", pick: (v) => v.smpAmount, format: (n) => formatAmount(n) },
  { key: "recQ", label: () => "REC수량", pick: (v) => v.recQuantity, format: (n) => formatAmount(n) },
  { key: "rec", label: () => "REC매출", pick: (v) => v.recAmount, format: (n) => formatAmount(n) },
  { key: "total", label: () => "매출총액", pick: (v) => v.totalAmount, format: (n) => formatAmount(n) },
]

const th =
  "border-b border-r border-border bg-muted px-3 py-2 text-center text-sm font-medium whitespace-nowrap"
const td = "border-r border-border px-3 py-1.5 text-right text-sm tabular-nums whitespace-nowrap"
const periodCol = "bg-accent/30 font-medium"

// 한 묶음(발전소 1개 또는 여러 발전소 합계)의 열별 값
type BlockValues = (Value | null)[]

function plantBlock(plant: LedgerPlant): BlockValues {
  return COLUMNS.map((col) =>
    col.kind === "month"
      ? plant.months[col.index]
      : summarizeMonths(plant.months.slice(col.from, col.to)),
  )
}

function totalBlock(plants: LedgerPlant[]): BlockValues {
  const monthTotals = Array.from({ length: 12 }, (_, i) =>
    summarizePlants(plants.map((p) => p.months[i])),
  )
  return COLUMNS.map((col) =>
    col.kind === "month"
      ? monthTotals[col.index]
      : summarizeYearTotal(monthTotals.slice(col.from, col.to)),
  )
}

function hasValue(v: Value | null): v is Value {
  return v !== null && (!("count" in v) || v.count > 0)
}

type PhaseGroup = { label: string; plants: LedgerPlant[] }

function groupByPhase(plants: LedgerPlant[]): PhaseGroup[] {
  const byPhase = new Map<number | null, LedgerPlant[]>()
  for (const plant of plants) {
    const list = byPhase.get(plant.contractPhase) ?? []
    list.push(plant)
    byPhase.set(plant.contractPhase, list)
  }
  return [...byPhase.entries()]
    .sort(([a], [b]) => (a ?? Infinity) - (b ?? Infinity))
    .map(([phase, list]) => ({
      label: phase === null ? "차수 미지정" : `${phase}차`,
      plants: list,
    }))
}

export default async function PerformanceReportPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; client?: string }>
}) {
  const { year: yearParam, client: clientParam } = await searchParams

  const years = await getRevenueYears()
  const year =
    yearParam && years.includes(yearParam)
      ? yearParam
      : (years[0] ?? String(new Date().getFullYear()))

  // 그 해 SMP 데이터가 있는 거래처(데이터가 많은 순). 실적 보고서는 거래처 단위 문서.
  const [clientGroups, yearRows] = await Promise.all([
    prisma.clientGroup.findMany({ select: { id: true, name: true } }),
    prisma.smpMonthly.findMany({
      where: { parseStatus: "OK", billingYearMonth: { startsWith: `${year}-` } },
      select: { plant: { select: { clientGroupId: true } } },
    }),
  ])
  const rowCountByGroup = new Map<number, number>()
  for (const row of yearRows) {
    const id = row.plant?.clientGroupId
    if (id != null) rowCountByGroup.set(id, (rowCountByGroup.get(id) ?? 0) + 1)
  }
  const groupsWithData = clientGroups
    .filter((cg) => rowCountByGroup.has(cg.id))
    .sort((a, b) => (rowCountByGroup.get(b.id) ?? 0) - (rowCountByGroup.get(a.id) ?? 0))
  const clientGroup =
    groupsWithData.find((cg) => String(cg.id) === clientParam) ?? groupsWithData[0] ?? null

  const ledger = clientGroup
    ? await loadRevenueYear(year, { clientGroupId: clientGroup.id })
    : []
  const phases = groupByPhase(ledger)
  const grandTotal = totalBlock(ledger)

  const linkQuery = new URLSearchParams({
    year,
    ...(clientGroup ? { client: String(clientGroup.id) } : {}),
  }).toString()

  function renderValueCells(values: BlockValues, row: (typeof ROWS)[number], strong: boolean) {
    return COLUMNS.map((col, i) => {
      const value = values[i]
      return (
        <td
          key={i}
          className={cn(
            td,
            col.kind === "period" && periodCol,
            strong && "font-semibold",
            hasValue(value) && value.status && statusTextClass(value.status),
          )}
        >
          {hasValue(value) ? row.format(row.pick(value)) : "-"}
        </td>
      )
    })
  }

  function renderBlock({
    key,
    phaseCell,
    nameCell,
    values,
    region,
    strong,
  }: {
    key: string
    phaseCell?: React.ReactNode
    nameCell: React.ReactNode
    values: BlockValues
    region: string | null
    strong: boolean
  }) {
    return ROWS.map((row, r) => (
      <tr
        key={`${key}-${row.key}`}
        className={cn(r === ROWS.length - 1 && "[&>td]:border-b-2 [&>td]:border-b-foreground/20", strong && "bg-muted/60")}
      >
        {r === 0 && phaseCell}
        {r === 0 && (
          <td
            rowSpan={ROWS.length}
            className={cn(
              td,
              "sticky left-16 z-[1] w-48 border-b-2 border-b-foreground/20 text-left align-top whitespace-normal",
              strong ? "bg-muted font-semibold" : "bg-card font-medium",
            )}
          >
            {nameCell}
          </td>
        )}
        <td
          className={cn(
            td,
            "sticky left-64 z-[1] w-36 text-left text-muted-foreground",
            strong ? "bg-muted" : "bg-card",
          )}
        >
          {row.label(region)}
        </td>
        {renderValueCells(values, row, strong)}
      </tr>
    ))
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">실적 보고서</h1>
          <p className="text-sm text-muted-foreground">
            2번 매출 보고서(통합 확정본)와 같은 배치로, 계약차수별 발전소 실적과
            총합을 보여줘요.
          </p>
        </div>
        <Button variant="outline" size="sm" render={<Link href={`/reports?${linkQuery}`} />}>
          <Table2 /> 매출 현황
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ParamSelect
          basePath="/reports/performance"
          name="year"
          value={year}
          options={(years.length > 0 ? years : [year]).map((y) => ({ value: y, label: `${y}년` }))}
          params={clientGroup ? { client: String(clientGroup.id) } : {}}
          className="w-28"
        />
        {clientGroup && (
          <ParamSelect
            basePath="/reports/performance"
            name="client"
            value={String(clientGroup.id)}
            options={groupsWithData.map((cg) => ({ value: String(cg.id), label: cg.name }))}
            params={{ year }}
            className="w-44"
          />
        )}
      </div>

      {!clientGroup || ledger.length === 0 ? (
        <div className="rounded-xl border p-8 text-center text-sm text-muted-foreground">
          {year}년에 집계할 SMP 데이터가 없어요.
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <StatusLegend />
            <div className="max-h-[75vh] overflow-auto rounded-xl border bg-card">
              <table className="w-full min-w-[1900px] border-separate border-spacing-0">
                <thead className="sticky top-0 z-10">
                  <tr>
                    <th className={cn(th, "sticky left-0 z-20 w-16")}>구분</th>
                    <th className={cn(th, "sticky left-16 z-20 w-48 text-left")}>발전소</th>
                    <th className={cn(th, "sticky left-64 z-20 w-36 text-left")}>항목</th>
                    {COLUMNS.map((col) => (
                      <th key={col.label} className={cn(th, "w-28", col.kind === "period" && "bg-accent")}>
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {phases.map((phase) => {
                    const phaseRowSpan = (phase.plants.length + 1) * ROWS.length
                    const phaseCell = (
                      <td
                        rowSpan={phaseRowSpan}
                        className={cn(
                          td,
                          "sticky left-0 z-[1] w-16 border-b-2 border-b-foreground/30 bg-card text-center align-top font-semibold",
                        )}
                      >
                        {phase.label}
                      </td>
                    )
                    return [
                      ...phase.plants.flatMap((plant, index) =>
                        renderBlock({
                          key: `p${plant.id}`,
                          phaseCell: index === 0 ? phaseCell : undefined,
                          nameCell: (
                            <Link
                              href={`/reports/plants/${plant.id}?${linkQuery}`}
                              className="hover:underline"
                            >
                              {plant.name}
                              <span className="block text-xs font-normal text-muted-foreground">
                                {formatNumber(plant.capacityKw, 2)} kW
                              </span>
                            </Link>
                          ),
                          values: plantBlock(plant),
                          region: plant.irradianceRegion,
                          strong: false,
                        }),
                      ),
                      ...renderBlock({
                        key: `t${phase.label}`,
                        nameCell: (
                          <>
                            {phase.label} 총합
                            <span className="block text-xs font-normal text-muted-foreground">
                              {formatNumber(
                                phase.plants.reduce((acc, p) => acc + (p.capacityKw ?? 0), 0),
                                2,
                              )}{" "}
                              kW
                            </span>
                          </>
                        ),
                        values: totalBlock(phase.plants),
                        region: null,
                        strong: true,
                      }),
                    ]
                  })}
                  {renderBlock({
                    key: "grand",
                    phaseCell: (
                      <td
                        rowSpan={ROWS.length}
                        className={cn(td, "sticky left-0 z-[1] w-16 bg-muted text-center align-top font-semibold")}
                      >
                        전체
                      </td>
                    ),
                    nameCell: (
                      <>
                        {clientGroup.name} 총합
                        <span className="block text-xs font-normal text-muted-foreground">
                          {formatNumber(
                            ledger.reduce((acc, p) => acc + (p.capacityKw ?? 0), 0),
                            2,
                          )}{" "}
                          kW
                        </span>
                      </>
                    ),
                    values: grandTotal,
                    region: null,
                    strong: true,
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <SalesSummary name={clientGroup.name} year={year} plants={ledger} />
        </>
      )}
    </div>
  )
}

// 3번 엑셀 "판매금액 기준" 시트 아래의 발전실적 요약: 발전량(MWh)·판매금액(억원)·
// 일발전시간·판매단가 × 1~12월 + 계.
function SalesSummary({
  name,
  year,
  plants,
}: {
  name: string
  year: string
  plants: LedgerPlant[]
}) {
  const months = Array.from({ length: 12 }, (_, i) =>
    summarizePlants(plants.map((p) => p.months[i])),
  )
  const columns = [...months, summarizeYearTotal(months)]
  const rows: Array<{ label: string; value: (s: LedgerSummary) => string }> = [
    { label: "발전량 [MWh]", value: (s) => formatNumber(s.generationKwh / 1000, 2) },
    { label: "판매금액 [억원]", value: (s) => formatNumber(s.totalAmount / 100_000_000, 2) },
    { label: "일발전시간 [h]", value: (s) => formatNumber(s.generationHours, 2) },
    {
      label: "판매단가 [원/kWh]",
      value: (s) => formatNumber(s.generationKwh > 0 ? s.totalAmount / s.generationKwh : null, 2),
    },
  ]

  return (
    <div className="flex flex-col gap-2">
      <h2 className="font-semibold">
        {year}년 {name} 발전실적 요약
      </h2>
      <div className="overflow-auto rounded-xl border bg-card">
        <table className="w-full min-w-[1200px] border-separate border-spacing-0">
          <thead>
            <tr>
              <th className={cn(th, "w-40 text-left")}>구분</th>
              {months.map((_, i) => (
                <th key={i} className={th}>
                  {i + 1}월
                </th>
              ))}
              <th className={cn(th, "bg-accent")}>계</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <td className={cn(td, "border-b text-left font-medium")}>{row.label}</td>
                {columns.map((s, i) => (
                  <td
                    key={i}
                    className={cn(
                      td,
                      "border-b",
                      i === 12 && periodCol,
                      s.count > 0 && s.status && statusTextClass(s.status),
                    )}
                  >
                    {s.count > 0 ? row.value(s) : "-"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        판매금액 = SMP매출 + REC매출. 계의 일발전시간은 월 값의 평균이에요.
      </p>
    </div>
  )
}
