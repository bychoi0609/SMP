import Link from "next/link"

import { Button } from "@/components/ui/button"
import { ClientGroupFilterBar } from "@/components/client-group-filter-bar"
import { prisma } from "@/lib/prisma"
import { getSmpReportRowsAction, getSolarIrradianceMonthlyAction } from "../smp/actions"
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

  let plants: {
    id: number
    plantName: string
    plantAlias: string | null
    capacityKw: number | null
    irradianceRegion: string | null
    contractNumber: string | null
  }[] = []
  let reportRows: Awaited<ReturnType<typeof getSmpReportRowsAction>> = []
  let irradianceByRegion: Record<string, number | null> = {}

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

    const [plantRows, rows, irradiance] = await Promise.all([
      confirmedClientGroupIds.length > 0
        ? prisma.plantMaster.findMany({
            where: {
              clientGroupId: { in: confirmedClientGroupIds },
              ...(query
                ? {
                    OR: [
                      { plantName: { contains: query } },
                      { plantAlias: { contains: query } },
                    ],
                  }
                : {}),
            },
            orderBy: { constructionOrder: "asc" },
            select: {
              id: true,
              plantName: true,
              plantAlias: true,
              capacityKw: true,
              irradianceRegion: true,
              contractNumber: true,
            },
          })
        : Promise.resolve([]),
      getSmpReportRowsAction(billingYearMonth),
      getSolarIrradianceMonthlyAction(billingYearMonth),
    ])
    plants = plantRows.map((plant) => ({
      ...plant,
      capacityKw: plant.capacityKw ? Number(plant.capacityKw) : null,
    }))
    reportRows = rows
    irradianceByRegion = irradiance
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">REC 데이터</h1>
          <p className="text-sm text-muted-foreground">
            &quot;SMP 데이터 수집&quot;에서 확정된 월별 데이터가 이곳에
            자동으로 반영됩니다. REC수량·단가는 발전소별로 개별 수정할 수
            있습니다.
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
          <RecGrid
            month={billingYearMonth}
            plants={plants}
            initialRows={reportRows}
            irradianceByRegion={irradianceByRegion}
          />
        </div>
      )}
    </div>
  )
}
