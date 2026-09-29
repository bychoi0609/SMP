import { prisma } from "@/lib/prisma"
import { formatAmount } from "@/lib/format"
import { daysSince, isOutstanding } from "@/features/receipts/lib/outstanding"

export type StatusTone = "neutral" | "success" | "warning" | "danger"

export type StatusBadge = { label: string; tone: StatusTone }

// 세금계산서 발행 마감일(매월 25일 전후, CLAUDE.md 참고).
const INVOICE_DEADLINE_DAY = 25

// 서버는 UTC로 돌기 때문에 날짜 판단은 한국시간 기준으로 맞춘다.
function todayInKorea(): Date {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000)
  return new Date(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate())
}

// 기본 귀속월(전월). date.ts의 defaultBillingMonth와 같지만 한국시간 기준.
function previousMonth(today: Date): string {
  const d = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function monthLabel(month: string): string {
  return `${Number(month.slice(5, 7))}월`
}

function yearMonthLabel(month: string): string {
  return `${month.slice(0, 4)}년 ${Number(month.slice(5, 7))}월`
}

// 메인 화면 카드별 상태 뱃지. 키는 카드의 href.
export async function getDashboardStatus(): Promise<Record<string, StatusBadge[]>> {
  const today = todayInKorea()
  const month = previousMonth(today)
  const m = monthLabel(month)

  const [
    plants,
    clientGroupCount,
    needsReviewCount,
    smpConfirmations,
    smpSupply,
    recRows,
    recDefault,
    receiptConfirmations,
    latestReceipt,
    latestInvoice,
    taxInvoiceRows,
  ] = await Promise.all([
    prisma.plantMaster.findMany({ select: { id: true, clientGroupId: true } }),
    prisma.clientGroup.count(),
    prisma.smpMonthly.count({ where: { parseStatus: "NEEDS_REVIEW" } }),
    prisma.smpMonthlyConfirmation.findMany({
      where: { billingYearMonth: month, status: "CONFIRMED" },
      select: { clientGroupId: true },
    }),
    prisma.smpMonthly.aggregate({
      where: { billingYearMonth: month, plantId: { not: null } },
      _sum: { supplyAmount: true },
      _count: true,
    }),
    prisma.recMonthly.findMany({
      where: { billingYearMonth: month, status: "CONFIRMED" },
      select: { plantId: true },
    }),
    prisma.recMonthlyDefault.findUnique({ where: { billingYearMonth: month } }),
    prisma.receiptMonthlyConfirmation.count({
      where: { billingYearMonth: month, status: "CONFIRMED" },
    }),
    prisma.receiptMonthlyConfirmation.findFirst({
      where: { category: "RECEIPT", status: "CONFIRMED" },
      orderBy: { billingYearMonth: "desc" },
      select: { billingYearMonth: true },
    }),
    prisma.receiptMonthlyConfirmation.findFirst({
      where: { category: { in: ["SALES", "PURCHASE"] }, status: "CONFIRMED" },
      orderBy: { billingYearMonth: "desc" },
      select: { billingYearMonth: true },
    }),
    prisma.receiptTaxInvoiceRow.findMany({
      select: {
        direction: true,
        paymentBasisAccount: true,
        paymentDate: true,
        writtenDate: true,
      },
    }),
  ])

  const status: Record<string, StatusBadge[]> = {}

  // ── 태양광 ──────────────────────────────────────────────
  const activeClientGroupIds = new Set(plants.map((p) => p.clientGroupId))
  status["/plants"] = [
    { label: `발전소 ${plants.length}곳 · 거래처 ${clientGroupCount}곳`, tone: "neutral" },
  ]

  const smp: StatusBadge[] = []
  if (needsReviewCount > 0) {
    smp.push({ label: `검토필요 ${needsReviewCount}건`, tone: "warning" })
  }
  const confirmedGroupIds = new Set(smpConfirmations.map((c) => c.clientGroupId))
  const confirmedGroups = [...activeClientGroupIds].filter((id) => confirmedGroupIds.has(id)).length
  smp.push({
    label: `${m} 확정 ${confirmedGroups}/${activeClientGroupIds.size} 거래처`,
    tone: confirmedGroups >= activeClientGroupIds.size ? "success" : "neutral",
  })
  const daysLeft = INVOICE_DEADLINE_DAY - today.getDate()
  if (daysLeft >= 0) {
    smp.push({
      label: daysLeft === 0 ? "세금계산서 마감 오늘" : `세금계산서 마감 D-${daysLeft}`,
      tone: daysLeft <= 3 ? "danger" : daysLeft <= 7 ? "warning" : "neutral",
    })
  }
  status["/smp"] = smp

  const rec: StatusBadge[] = []
  const recTargetPlantIds = new Set(
    plants.filter((p) => confirmedGroupIds.has(p.clientGroupId)).map((p) => p.id),
  )
  if (recTargetPlantIds.size === 0) {
    rec.push({ label: `${m} SMP 확정 대기`, tone: "neutral" })
  } else {
    const recDone = recRows.filter((r) => recTargetPlantIds.has(r.plantId)).length
    rec.push({
      label: `${m} 확정 ${recDone}/${recTargetPlantIds.size}곳`,
      tone: recDone >= recTargetPlantIds.size ? "success" : "warning",
    })
    if (!recDefault) rec.push({ label: "대표단가 미입력", tone: "warning" })
  }
  status["/rec"] = rec

  status["/reports"] =
    smpSupply._count > 0
      ? [{ label: `${m} SMP 공급가액 ${formatAmount(smpSupply._sum.supplyAmount)}원`, tone: "neutral" }]
      : [{ label: `${m} 데이터 없음`, tone: "neutral" }]

  // ── 영수증/세금계산서 ─────────────────────────────────────
  // 카테고리는 매출·매입·영수증 3종.
  status["/receipts"] = [
    {
      label: `${m} 확정 ${receiptConfirmations}/3`,
      tone: receiptConfirmations >= 3 ? "success" : "warning",
    },
  ]

  status["/receipts/monthly-receipts"] = [
    latestReceipt
      ? { label: `최근 확정 ${yearMonthLabel(latestReceipt.billingYearMonth)}`, tone: "neutral" }
      : { label: "확정된 데이터 없음", tone: "neutral" },
  ]

  status["/receipts/monthly-invoices"] = [
    latestInvoice
      ? { label: `최근 확정 ${yearMonthLabel(latestInvoice.billingYearMonth)}`, tone: "neutral" }
      : { label: "확정된 데이터 없음", tone: "neutral" },
  ]

  const receivables = taxInvoiceRows.filter(
    (r) => r.direction === "SALES" && isOutstanding(r, "sales"),
  )
  const payables = taxInvoiceRows.filter(
    (r) => r.direction === "PURCHASE" && isOutstanding(r, "purchase"),
  )
  const over90 = [...receivables, ...payables].filter(
    (r) => daysSince(r.writtenDate, today) > 90,
  ).length
  const outstanding: StatusBadge[] = [
    { label: `미수 ${receivables.length}건 · 미지급 ${payables.length}건`, tone: "neutral" },
  ]
  if (over90 > 0) outstanding.push({ label: `90일 초과 ${over90}건`, tone: "danger" })
  status["/receipts/outstanding"] = outstanding

  return status
}
