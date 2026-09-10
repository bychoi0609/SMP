import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ClientGroupFilterBar } from "@/components/client-group-filter-bar"
import { prisma } from "@/lib/prisma"
import type { Prisma } from "@/generated/prisma/client"
import { formatAmount } from "@/lib/format"
import { computeBillingStatus, type BillingStatus } from "@/lib/billing-status"
import { PlantPicker } from "./plant-picker"

type ClientGroupSummary = {
  name: string
  plantCount: number
  generationKwh: number
  supplyAmount: number
  vatAmount: number
  recAmount: number
  statusCounts: Record<BillingStatus, number>
}

function badgeVariant(status: BillingStatus) {
  if (status === "확정") return "secondary" as const
  if (status === "SMP확정") return "outline" as const
  return "destructive" as const
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; q?: string }>
}) {
  const { client: clientParam, q: qParam } = await searchParams
  const clientGroupId = clientParam ? Number(clientParam) : undefined
  const query = qParam?.trim() || undefined

  const plantWhere: Prisma.PlantMasterWhereInput = {}
  if (clientGroupId) plantWhere.clientGroupId = clientGroupId
  if (query) {
    plantWhere.OR = [
      { plantName: { contains: query } },
      { plantAlias: { contains: query } },
    ]
  }

  const [smpRows, recRows, plants, clientGroupOptions] = await Promise.all([
    prisma.smpMonthly.findMany({
      where: {
        parseStatus: "OK",
        ...(Object.keys(plantWhere).length ? { plant: plantWhere } : {}),
      },
      include: { plant: { include: { clientGroup: true } } },
      orderBy: { billingYearMonth: "desc" },
    }),
    prisma.recMonthly.findMany(),
    prisma.plantMaster.findMany({
      orderBy: { constructionOrder: "asc" },
      select: { id: true, plantName: true, plantAlias: true },
    }),
    prisma.clientGroup.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ])

  const recByKey = new Map(
    recRows.map((r) => [`${r.plantId}-${r.billingYearMonth}`, r]),
  )

  const byMonth = new Map<string, Map<number, ClientGroupSummary>>()

  for (const row of smpRows) {
    if (!row.plant) continue
    const month = row.billingYearMonth
    if (!byMonth.has(month)) byMonth.set(month, new Map())
    const clientGroups = byMonth.get(month)!

    const cg = row.plant.clientGroup
    if (!clientGroups.has(cg.id)) {
      clientGroups.set(cg.id, {
        name: cg.name,
        plantCount: 0,
        generationKwh: 0,
        supplyAmount: 0,
        vatAmount: 0,
        recAmount: 0,
        statusCounts: { 미청구: 0, SMP확정: 0, 확정: 0 },
      })
    }
    const summary = clientGroups.get(cg.id)!

    const rec = recByKey.get(`${row.plantId}-${month}`)
    const status = computeBillingStatus(
      row.taxInvoiceStatus === "ISSUED",
      rec?.status === "CONFIRMED",
    )

    summary.plantCount += 1
    summary.generationKwh += row.generationKwh ? Number(row.generationKwh) : 0
    summary.supplyAmount += row.supplyAmount ? Number(row.supplyAmount) : 0
    summary.vatAmount += row.vatAmount ? Number(row.vatAmount) : 0
    summary.recAmount += rec?.amount ? Number(rec.amount) : 0
    summary.statusCounts[status] += 1
  }

  const months = [...byMonth.keys()].sort((a, b) => b.localeCompare(a))

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">리포트</h1>
          <p className="text-sm text-muted-foreground">
            거래처·월별 매출 합계와 청구 상태를 한눈에 확인합니다.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ClientGroupFilterBar
            basePath="/reports"
            clientGroups={clientGroupOptions}
            selectedClientGroupId={clientGroupId}
            query={qParam}
          />
          <PlantPicker plants={plants} />
        </div>
      </div>

      {months.length === 0 && (
        <div className="rounded-xl border p-8 text-center text-muted-foreground">
          아직 집계할 SMP 데이터가 없습니다. SMP 메뉴에서 메일을 먼저
          수집해 주세요.
        </div>
      )}

      {months.map((month) => {
        const clientGroups = [...byMonth.get(month)!.values()]
        const total = clientGroups.reduce(
          (acc, g) => ({
            plantCount: acc.plantCount + g.plantCount,
            generationKwh: acc.generationKwh + g.generationKwh,
            supplyAmount: acc.supplyAmount + g.supplyAmount,
            vatAmount: acc.vatAmount + g.vatAmount,
            recAmount: acc.recAmount + g.recAmount,
          }),
          { plantCount: 0, generationKwh: 0, supplyAmount: 0, vatAmount: 0, recAmount: 0 },
        )

        return (
          <div key={month} className="flex flex-col gap-3">
            <h2 className="font-semibold">{month} 귀속월</h2>
            <div className="overflow-hidden rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-40">거래처</TableHead>
                    <TableHead className="w-24 text-center">발전소 수</TableHead>
                    <TableHead className="w-32 text-center">발전량(kWh)</TableHead>
                    <TableHead className="w-36 text-center">SMP 공급가액</TableHead>
                    <TableHead className="w-32 text-center">REC 금액</TableHead>
                    <TableHead className="w-32 text-center">매출총액</TableHead>
                    <TableHead>청구 상태</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientGroups.map((g) => (
                    <TableRow key={g.name}>
                      <TableCell className="font-medium">{g.name}</TableCell>
                      <TableCell className="tabular-nums">
                        {g.plantCount}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {formatAmount(g.generationKwh)}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {formatAmount(g.supplyAmount)}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {formatAmount(g.recAmount)}
                      </TableCell>
                      <TableCell className="tabular-nums font-medium">
                        {formatAmount(g.supplyAmount + g.recAmount)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap justify-center gap-1">
                          {(Object.keys(g.statusCounts) as BillingStatus[])
                            .filter((s) => g.statusCounts[s] > 0)
                            .map((s) => (
                              <Badge key={s} variant={badgeVariant(s)}>
                                {s} {g.statusCounts[s]}
                              </Badge>
                            ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell>전체 합계</TableCell>
                    <TableCell className="tabular-nums">
                      {total.plantCount}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatAmount(total.generationKwh)}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatAmount(total.supplyAmount)}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatAmount(total.recAmount)}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatAmount(total.supplyAmount + total.recAmount)}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </div>
        )
      })}
    </div>
  )
}
