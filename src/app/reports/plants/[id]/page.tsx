import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { prisma } from "@/lib/prisma"
import { formatAmount, formatNumber } from "@/lib/format"
import { computeBillingStatus } from "@/lib/billing-status"

function badgeVariant(status: string) {
  if (status === "확정") return "secondary" as const
  if (status === "SMP확정") return "outline" as const
  return "destructive" as const
}

export default async function PlantReportPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const plantId = Number(id)
  if (!Number.isInteger(plantId)) notFound()

  const plant = await prisma.plantMaster.findUnique({
    where: { id: plantId },
    include: { clientGroup: true },
  })
  if (!plant) notFound()

  const [smpRows, recRows] = await Promise.all([
    prisma.smpMonthly.findMany({
      where: { plantId, parseStatus: "OK" },
      orderBy: { billingYearMonth: "desc" },
    }),
    prisma.recMonthly.findMany({ where: { plantId } }),
  ])

  const recByMonth = new Map(recRows.map((r) => [r.billingYearMonth, r]))
  const capacityKw = plant.capacityKw ? Number(plant.capacityKw) : null

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button variant="ghost" size="sm" render={<Link href="/reports" />}>
          <ArrowLeft /> 리포트로
        </Button>
        <h1 className="mt-1 text-xl font-semibold">
          {plant.plantAlias ?? plant.plantName}
        </h1>
        <p className="text-sm text-muted-foreground">
          {plant.plantName} · {plant.clientGroup.name} ·{" "}
          {capacityKw ? `${capacityKw} kW` : "용량 미확인"}
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">귀속월</TableHead>
              <TableHead className="w-28 text-center">발전량(kWh)</TableHead>
              <TableHead className="w-24 text-center">발전시간(h)</TableHead>
              <TableHead className="w-24 text-center">SMP단가</TableHead>
              <TableHead className="w-28 text-center">SMP금액</TableHead>
              <TableHead className="w-24 text-center">REC수량</TableHead>
              <TableHead className="w-28 text-center">REC금액</TableHead>
              <TableHead className="w-28 text-center">매출총액</TableHead>
              <TableHead className="w-28">청구상태</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {smpRows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="h-32 whitespace-normal text-center text-muted-foreground"
                >
                  아직 이 발전소의 SMP 데이터가 없습니다.
                </TableCell>
              </TableRow>
            )}
            {smpRows.map((row) => {
              const generationKwh = row.generationKwh
                ? Number(row.generationKwh)
                : null
              const generationHours =
                generationKwh !== null && capacityKw
                  ? generationKwh / capacityKw
                  : null
              const rec = recByMonth.get(row.billingYearMonth)
              const supplyAmount = row.supplyAmount ? Number(row.supplyAmount) : 0
              const recAmount = rec?.amount ? Number(rec.amount) : 0
              const status = computeBillingStatus(
                row.taxInvoiceStatus === "ISSUED",
                rec?.status === "CONFIRMED",
              )

              return (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">
                    {row.billingYearMonth}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {formatAmount(generationKwh)}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {generationHours !== null
                      ? formatNumber(generationHours, 1)
                      : "-"}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {row.smpUnitPrice ? formatNumber(Number(row.smpUnitPrice), 2) : "-"}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {formatAmount(supplyAmount)}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {rec ? formatAmount(Number(rec.quantity)) : "-"}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {rec ? formatAmount(recAmount) : "-"}
                  </TableCell>
                  <TableCell className="tabular-nums font-medium">
                    {formatAmount(supplyAmount + recAmount)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={badgeVariant(status)}>{status}</Badge>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
