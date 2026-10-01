import Link from "next/link"

import { Button } from "@/components/ui/button"
import { ClientGroupFilterBar } from "@/components/client-group-filter-bar"
import { prisma } from "@/lib/prisma"
import { visiblePlantWhere } from "@/lib/plant-status"
import { REPORT_PLANT_SELECT, toReportPlant } from "@/lib/report-plant"
import {
  getSmpReportRowsAction,
  getSolarIrradianceMonthlyAction,
  type ReportPlant,
} from "../smp/actions"
import { getRecDefaultPriceAction } from "./actions"
import { MonthPicker } from "./month-picker"
import { RecGrid } from "./rec-grid"

export default async function RecPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; client?: string; q?: string }>
}) {
  const {
    month: monthParam,
    client: clientParam,
    q: qParam,
  } = await searchParams
  const clientGroupId = clientParam ? Number(clientParam) : undefined
  const query = qParam?.trim() || undefined

  const [confirmedMonths, clientGroups] = await Promise.all([
    prisma.smpMonthlyConfirmation.findMany({
      where: {
        status: "CONFIRMED",
        ...(clientGroupId ? { clientGroupId } : {}),
      },
      distinct: ["billingYearMonth"],
      select: { billingYearMonth: true },
      orderBy: { billingYearMonth: "desc" },
    }),
    prisma.clientGroup.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ])
  const months = confirmedMonths.map((m) => m.billingYearMonth)
  const billingYearMonth =
    monthParam && months.includes(monthParam) ? monthParam : months[0]

  let plants: ReportPlant[] = []
  let reportRows: Awaited<ReturnType<typeof getSmpReportRowsAction>> = []
  let irradianceByRegion: Record<string, number | null> = {}
  let defaultPrice: number | null = null

  if (billingYearMonth) {
    const confirmations = await prisma.smpMonthlyConfirmation.findMany({
      where: {
        status: "CONFIRMED",
        billingYearMonth,
        ...(clientGroupId ? { clientGroupId } : {}),
      },
      select: { clientGroupId: true },
    })
    const confirmedClientGroupIds = confirmations.map((c) => c.clientGroupId)

    const [plantRows, rows, irradiance, recDefaultPrice] = await Promise.all([
      confirmedClientGroupIds.length > 0
        ? prisma.plantMaster.findMany({
            where: {
              clientGroupId: { in: confirmedClientGroupIds },
              AND: [
                visiblePlantWhere(billingYearMonth),
                ...(query
                  ? [
                      {
                        OR: [
                          { plantName: { contains: query } },
                          { plantAlias: { contains: query } },
                        ],
                      },
                    ]
                  : []),
              ],
            },
            orderBy: { constructionOrder: "asc" },
            select: REPORT_PLANT_SELECT,
          })
        : Promise.resolve([]),
      getSmpReportRowsAction(billingYearMonth),
      getSolarIrradianceMonthlyAction(billingYearMonth),
      getRecDefaultPriceAction(billingYearMonth),
    ])
    plants = plantRows.map(toReportPlant)
    reportRows = rows
    irradianceByRegion = irradiance
    defaultPrice = recDefaultPrice
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">REC 데이터</h1>
          <p className="text-sm text-muted-foreground">
            SMP 확정된 달의 REC 월말 작업 화면이에요. 대표단가를 적용하고,
            실제 발급량과 개별 단가를 고친 뒤 확정해 주세요. 직접 입력한
            단가(개별)는 대표단가로 덮어쓰지 않아요.
          </p>
        </div>
        {months.length > 0 && billingYearMonth && (
          <MonthPicker
            months={months}
            selected={billingYearMonth}
            extraParams={{
              ...(clientParam ? { client: clientParam } : {}),
              ...(qParam ? { q: qParam } : {}),
            }}
          />
        )}
      </div>

      {months.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center gap-3 rounded-xl border text-sm text-muted-foreground">
          <p>확정된 SMP 데이터가 없습니다.</p>
          <Button variant="outline" size="sm" render={<Link href="/smp" />}>
            SMP 데이터 수집으로 이동
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <ClientGroupFilterBar
            basePath="/rec"
            clientGroups={clientGroups}
            selectedClientGroupId={clientGroupId}
            query={qParam}
            extraParams={{ month: billingYearMonth }}
          />
          {/* 표는 받은 데이터를 내부 상태로 들고 있으므로, 월·거래처·검색어가 바뀌면
              새로 마운트해 이전 월 데이터가 남지 않게 한다. */}
          <RecGrid
            key={`${billingYearMonth}-${clientGroupId ?? "all"}-${query ?? ""}`}
            month={billingYearMonth}
            plants={plants}
            initialRows={reportRows}
            irradianceByRegion={irradianceByRegion}
            initialDefaultPrice={defaultPrice}
          />
        </div>
      )}
    </div>
  )
}
