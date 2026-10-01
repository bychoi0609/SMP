import { prisma } from "@/lib/prisma"
import { isRecSettled } from "@/lib/billing-status"
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
    smpMonthRows,
    recRows,
    recDefault,
    receiptConfirmations,
    latestReceipt,
    latestInvoice,
    taxInvoiceRows,
  ] = await Promise.all([
    prisma.plantMaster.findMany({
      select: { id: true, clientGroupId: true, operatingStatus: true },
    }),
    prisma.clientGroup.count(),
    prisma.smpMonthly.count({ where: { parseStatus: "NEEDS_REVIEW" } }),
    prisma.smpMonthlyConfirmation.findMany({
      where: { billingYearMonth: month, status: "CONFIRMED" },
      select: { clientGroupId: true, invoiceIssuedAt: true },
    }),
    prisma.smpMonthly.findMany({
      where: { billingYearMonth: month, plantId: { not: null } },
      select: { plantId: true },
    }),
    prisma.recMonthly.findMany({
      where: { billingYearMonth: month, status: "CONFIRMED" },
      select: { plantId: true, status: true, quantity: true, unitPrice: true },
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
  // 마감 경고는 "SMP 세금계산서 발행 및 발행 요청 완료"가 체크되지 않은 거래처 기준.
  // 아직 SMP 확정 전인 거래처도 발행 전이므로 미발행으로 센다.
  const issuedGroupIds = new Set(
    smpConfirmations.filter((c) => c.invoiceIssuedAt).map((c) => c.clientGroupId),
  )
  const unissuedGroups = [...activeClientGroupIds].filter((id) => !issuedGroupIds.has(id)).length
  const daysLeft = INVOICE_DEADLINE_DAY - today.getDate()
  if (activeClientGroupIds.size > 0 && unissuedGroups === 0) {
    smp.push({ label: `${m} 발행 완료`, tone: "success" })
  } else if (daysLeft >= 0) {
    const deadline = daysLeft === 0 ? "마감 오늘" : `마감 D-${daysLeft}`
    smp.push({
      label: `미발행 ${unissuedGroups}곳 · ${deadline}`,
      tone: daysLeft <= 3 ? "danger" : daysLeft <= 7 ? "warning" : "neutral",
    })
  }
  status["/smp"] = smp

  // REC 수량·단가까지 확정된 발전소(단가 없이 수량만 입력된 행은 제외).
  const settledRecPlantIds = new Set(
    recRows
      .filter((r) =>
        isRecSettled({
          status: r.status,
          quantity: Number(r.quantity),
          unitPrice: Number(r.unitPrice),
        }),
      )
      .map((r) => r.plantId),
  )

  const rec: StatusBadge[] = []
  const recTargetPlantIds = new Set(
    plants.filter((p) => confirmedGroupIds.has(p.clientGroupId)).map((p) => p.id),
  )
  if (recTargetPlantIds.size === 0) {
    rec.push({ label: `${m} SMP 확정 대기`, tone: "neutral" })
  } else {
    const recDone = [...recTargetPlantIds].filter((id) => settledRecPlantIds.has(id)).length
    rec.push({
      label: `${m} 확정 ${recDone}/${recTargetPlantIds.size}곳`,
      tone: recDone >= recTargetPlantIds.size ? "success" : "warning",
    })
    if (!recDefault) rec.push({ label: "대표단가 미입력", tone: "warning" })
  }
  status["/rec"] = rec

  // 청구 상태 집계: 폐지 발전소는 그 달 SMP 데이터가 있을 때만 대상에 넣는다.
  const monthDataPlantIds = new Set(smpMonthRows.map((r) => r.plantId))
  const reportPlants = plants.filter(
    (p) => p.operatingStatus !== "CLOSED" || monthDataPlantIds.has(p.id),
  )
  if (monthDataPlantIds.size === 0) {
    status["/reports"] = [{ label: `${m} 데이터 없음`, tone: "neutral" }]
  } else {
    const smpConfirmedPlants = reportPlants.filter((p) => confirmedGroupIds.has(p.clientGroupId))
    const settledPlants = smpConfirmedPlants.filter((p) => settledRecPlantIds.has(p.id)).length
    status["/reports"] = [
      {
        label: `${m} SMP확정 ${smpConfirmedPlants.length - settledPlants} · 확정 ${settledPlants} / 전체 ${reportPlants.length}곳`,
        tone: settledPlants >= reportPlants.length ? "success" : "neutral",
      },
    ]
  }

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
