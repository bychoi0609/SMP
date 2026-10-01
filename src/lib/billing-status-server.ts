import "server-only"

import { prisma } from "@/lib/prisma"
import { smpConfirmationKey } from "@/lib/billing-status"

// SMP 데이터가 확정된 (거래처, 귀속월) 조합을 smpConfirmationKey 형식의 Set으로 반환한다.
export async function getConfirmedSmpKeys(
  where: { clientGroupId?: number; billingYearMonth?: string } = {},
): Promise<Set<string>> {
  const rows = await prisma.smpMonthlyConfirmation.findMany({
    where: { status: "CONFIRMED", ...where },
    select: { clientGroupId: true, billingYearMonth: true },
  })
  return new Set(
    rows.map((row) => smpConfirmationKey(row.clientGroupId, row.billingYearMonth)),
  )
}
