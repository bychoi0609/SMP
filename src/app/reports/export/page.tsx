import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { Button } from "@/components/ui/button"
import { prisma } from "@/lib/prisma"
import { ExportWorkspace } from "./export-workspace"

// 제출 엑셀 채우기: 지난번에 낸 1·2·3번 파일을 올리면 고른 귀속월 칸에 앱 값을 채워 돌려준다.
export default async function ReportExportPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>
}) {
  const { client: clientParam } = await searchParams

  const [monthRows, confirmedRows, clientGroups, plantRows] = await Promise.all([
    prisma.smpMonthly.findMany({
      where: { parseStatus: "OK", plantId: { not: null } },
      distinct: ["billingYearMonth"],
      select: { billingYearMonth: true },
      orderBy: { billingYearMonth: "desc" },
    }),
    prisma.smpMonthlyConfirmation.findMany({
      where: { status: "CONFIRMED" },
      select: { billingYearMonth: true },
      orderBy: { billingYearMonth: "desc" },
      take: 1,
    }),
    prisma.clientGroup.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    // 발전소가 많은 거래처를 기본으로(키스트론처럼 보고서를 내는 거래처)
    prisma.plantMaster.groupBy({ by: ["clientGroupId"], _count: { _all: true } }),
  ])
  const months = monthRows.map((m) => m.billingYearMonth)
  const defaultMonth = confirmedRows[0]?.billingYearMonth ?? months[0] ?? ""
  const plantCount = new Map(plantRows.map((r) => [r.clientGroupId, r._count._all]))
  const groupsWithPlants = clientGroups.filter((cg) => plantCount.has(cg.id))
  const defaultClient =
    groupsWithPlants.find((cg) => String(cg.id) === clientParam) ??
    [...groupsWithPlants].sort((a, b) => (plantCount.get(b.id) ?? 0) - (plantCount.get(a.id) ?? 0))[0]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button variant="ghost" size="sm" render={<Link href="/reports" />}>
          <ArrowLeft /> 매출 현황으로
        </Button>
        <h1 className="mt-1 text-xl font-semibold">엑셀 내보내기</h1>
        <p className="text-sm text-muted-foreground">
          지난번에 제출한 매출 보고서(1번 발전소별 · 2번 통합 확정본 · 3번 월별 발전량)를 올리면,
          고른 귀속월 칸에만 앱 값을 채워 돌려드려요. 다른 달과 수식·서식·메모는 그대로 남아요.
        </p>
      </div>

      {months.length === 0 || !defaultClient ? (
        <div className="rounded-xl border p-8 text-center text-sm text-muted-foreground">
          채울 SMP 데이터가 아직 없어요.
        </div>
      ) : (
        <ExportWorkspace
          months={months}
          defaultMonth={defaultMonth}
          clientGroups={groupsWithPlants}
          defaultClientGroupId={defaultClient.id}
        />
      )}
    </div>
  )
}
