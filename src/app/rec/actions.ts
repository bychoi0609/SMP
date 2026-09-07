"use server"

import { revalidatePath } from "next/cache"

import { prisma } from "@/lib/prisma"
import { recRowFormSchema } from "@/lib/validations/rec"

// confirmQuantity가 true면(사용자가 REC수량을 직접 입력/확정한 경우) 상태를
// CONFIRMED로 저장해 이후 발전량이 바뀌어도 이 값을 그대로 유지한다. false면
// (예: REC단가만 수정하는 경우) 기존 상태를 건드리지 않는다 — 이미 CONFIRMED인
// 값을 단가 수정만으로 되돌리면 안 되고, 아직 TENTATIVE라면 계속 발전량 기반
// 예상치로 갱신되도록 남겨둬야 하기 때문.
export async function upsertRecRowAction(
  plantId: number,
  billingYearMonth: string,
  rawQuantity: number,
  rawUnitPrice: number,
  options?: { confirmQuantity?: boolean },
): Promise<{ error?: string }> {
  const parsed = recRowFormSchema.safeParse({
    quantity: rawQuantity,
    unitPrice: rawUnitPrice,
  })
  if (!parsed.success) {
    return { error: "입력값을 다시 확인해 주세요." }
  }

  const { quantity, unitPrice } = parsed.data
  const amount = quantity * unitPrice
  const confirmQuantity = options?.confirmQuantity ?? false

  await prisma.recMonthly.upsert({
    where: { plantId_billingYearMonth: { plantId, billingYearMonth } },
    update: {
      quantity,
      unitPrice,
      amount,
      ...(confirmQuantity ? { status: "CONFIRMED" as const } : {}),
    },
    create: {
      plantId,
      billingYearMonth,
      quantity,
      unitPrice,
      amount,
      status: confirmQuantity ? "CONFIRMED" : "TENTATIVE",
    },
  })

  revalidatePath("/rec")
  revalidatePath("/reports")
  revalidatePath("/")
  return {}
}
