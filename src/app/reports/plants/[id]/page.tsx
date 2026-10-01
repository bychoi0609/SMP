import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { prisma } from "@/lib/prisma"
import { formatAmount, formatNumber } from "@/lib/format"
import type { BillingStatus } from "@/lib/billing-status"
import { PLANT_OPERATING_STATUS_LABEL } from "@/lib/plant-status"
import { getRevenueYears, loadRevenueYear, summarizeMonths } from "@/lib/revenue-ledger"
import { cn } from "@/lib/utils"
import { ParamSelect } from "../../param-select"
import { statusTextClass } from "../../status-style"

function badgeVariant(status: BillingStatus) {
  if (status === "확정") return "secondary" as const
  if (status === "SMP확정") return "outline" as const
  return "destructive" as const
}

const th =
  "border-b border-r border-border bg-muted px-3 py-2.5 text-center text-sm font-medium whitespace-nowrap"
const td = "border-b border-r border-border px-3 py-2 text-right text-sm tabular-nums whitespace-nowrap"

// 1번 엑셀(매출 보고서_발전소별)의 발전소 시트와 같은 연간 월별 원장.
export default async function PlantLedgerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ year?: string; client?: string }>
}) {
  const { id } = await params
  const { year: yearParam, client: clientParam } = await searchParams
  const plantId = Number(id)
  if (!Number.isInteger(plantId)) notFound()

  const plant = await prisma.plantMaster.findUnique({
    where: { id: plantId },
    include: { clientGroup: true },
  })
  if (!plant) notFound()

  const years = await getRevenueYears()
  const year =
    yearParam && /^\d{4}$/.test(yearParam)
      ? yearParam
      : (years[0] ?? String(new Date().getFullYear()))
  const yearOptions = [...new Set([year, ...years])].sort((a, b) => b.localeCompare(a))

  const [ledger, siblings] = await Promise.all([
    loadRevenueYear(year, { id: plantId }),
    // 같은 거래처 안에서 건설순서로 이전/다음 발전소
    prisma.plantMaster.findMany({
      where: {
        clientGroupId: plant.clientGroupId,
        OR: [{ operatingStatus: { not: "CLOSED" } }, { id: plantId }],
      },
      orderBy: { constructionOrder: "asc" },
      select: { id: true },
    }),
  ])
  // 폐지 발전소는 그 해 데이터가 없으면 로더에서 빠지므로 빈 달로 채운다.
  const months = ledger[0]?.months ?? Array(12).fill(null)
  const summary = ledger[0]?.year ?? summarizeMonths(months)

  const position = siblings.findIndex((s) => s.id === plantId)
  const prevId = position > 0 ? siblings[position - 1].id : null
  const nextId = position >= 0 && position < siblings.length - 1 ? siblings[position + 1].id : null
  const linkParams = (extra: Record<string, string> = {}) =>
    new URLSearchParams({
      year,
      ...(clientParam ? { client: clientParam } : {}),
      ...extra,
    }).toString()

  const capacityKw = plant.capacityKw ? Number(plant.capacityKw) : null
  const shortYear = year.slice(2)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" render={<Link href={`/reports?${linkParams()}`} />}>
            <ArrowLeft /> 매출 현황으로
          </Button>
          <h1 className="mt-1 text-xl font-semibold">
            {plant.plantAlias ?? plant.plantName}
          </h1>
          <p className="text-sm text-muted-foreground">
            {plant.plantName} · {plant.clientGroup.name} ·{" "}
            {capacityKw ? `${formatNumber(capacityKw, 2)} kW` : "용량 미확인"} ·{" "}
            {plant.contractPhase ? `${plant.contractPhase}차` : "계약차수 미지정"} · REC 가중치{" "}
            {Number(plant.recWeight)} · {PLANT_OPERATING_STATUS_LABEL[plant.operatingStatus]}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ParamSelect
            basePath={`/reports/plants/${plantId}`}
            name="year"
            value={year}
            options={yearOptions.map((y) => ({ value: y, label: `${y}년` }))}
            params={clientParam ? { client: clientParam } : {}}
            className="w-28"
          />
          <Button
            variant="outline"
            size="icon"
            disabled={prevId === null}
            aria-label="이전 발전소"
            render={prevId !== null ? <Link href={`/reports/plants/${prevId}?${linkParams()}`} /> : undefined}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="icon"
            disabled={nextId === null}
            aria-label="다음 발전소"
            render={nextId !== null ? <Link href={`/reports/plants/${nextId}?${linkParams()}`} /> : undefined}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>

      <div className="overflow-auto rounded-xl border bg-card">
        <table className="w-full min-w-[1000px] border-separate border-spacing-0">
          <thead>
            <tr>
              <th className={cn(th, "w-24")}>구분</th>
              <th className={th}>발전량(kWh)</th>
              <th className={th}>발전시간(h)</th>
              <th className={th}>SMP 단가</th>
              <th className={th}>SMP 금액</th>
              <th className={th}>REC 수량</th>
              <th className={th}>REC 금액</th>
              <th className={th}>매출액(SMP+REC)</th>
              <th className={cn(th, "w-24")}>비고</th>
            </tr>
          </thead>
          <tbody>
            {months.map((cell, i) => {
              const label = `${shortYear}년 ${String(i + 1).padStart(2, "0")}월`
              if (!cell) {
                return (
                  <tr key={i}>
                    <td className={cn(td, "text-center font-medium")}>{label}</td>
                    {Array.from({ length: 7 }, (_, j) => (
                      <td key={j} className={cn(td, "text-muted-foreground")}>
                        -
                      </td>
                    ))}
                    <td className={td} />
                  </tr>
                )
              }
              const tone = statusTextClass(cell.status)
              return (
                <tr key={i}>
                  <td className={cn(td, "text-center font-medium")}>{label}</td>
                  <td className={cn(td, tone)}>
                    {formatAmount(cell.generationKwh === null ? null : Math.round(cell.generationKwh))}
                  </td>
                  <td className={cn(td, tone)}>{formatNumber(cell.generationHours, 2)}</td>
                  <td className={cn(td, tone)}>{formatNumber(cell.smpUnitPrice, 2)}</td>
                  <td className={cn(td, tone)}>{formatAmount(cell.smpAmount)}</td>
                  <td className={cn(td, tone)}>
                    {cell.recQuantityIsEstimate && cell.recQuantity !== null && (
                      <span className="mr-1 rounded bg-muted px-1 text-[10px] text-muted-foreground">
                        예상
                      </span>
                    )}
                    {formatAmount(cell.recQuantity)}
                  </td>
                  <td className={cn(td, tone)}>{formatAmount(cell.recAmount)}</td>
                  <td className={cn(td, tone, "font-medium")}>{formatAmount(cell.totalAmount)}</td>
                  <td className={cn(td, "text-center")}>
                    <Badge variant={badgeVariant(cell.status)}>{cell.status}</Badge>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td className={cn(td, "bg-muted text-center")}>총합(평균)</td>
              <td className={cn(td, "bg-muted")}>{formatAmount(Math.round(summary.generationKwh))}</td>
              <td className={cn(td, "bg-muted")}>{formatNumber(summary.generationHours, 2)}</td>
              <td className={cn(td, "bg-muted")}>{formatNumber(summary.smpUnitPrice, 2)}</td>
              <td className={cn(td, "bg-muted")}>{formatAmount(summary.smpAmount)}</td>
              <td className={cn(td, "bg-muted")}>{formatAmount(summary.recQuantity)}</td>
              <td className={cn(td, "bg-muted")}>{formatAmount(summary.recAmount)}</td>
              <td className={cn(td, "bg-muted")}>{formatAmount(summary.totalAmount)}</td>
              <td className={cn(td, "bg-muted")} />
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        발전시간 = 발전량 ÷ (설비용량 × 일수). 총합 줄의 발전시간·SMP 단가는 데이터가 있는
        달의 평균이에요. REC 금액은 단가가 입력된 달만 표시돼요.
      </p>
    </div>
  )
}
