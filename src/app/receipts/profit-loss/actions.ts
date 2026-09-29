"use server"

import { revalidatePath } from "next/cache"

import { prisma } from "@/lib/prisma"
import {
  profitLossManualEntrySchema,
  type ProfitLossManualEntryInput,
} from "@/lib/validations/profit-loss"
import type { ManualEntryDTO } from "@/features/receipts/lib/profitLoss"

const PROFIT_LOSS_PATH = "/receipts/profit-loss"

// 손익계산서 수기 항목(급여·감가상각 등 증빙 없는 비용/수익) 전체. 1인 사업자 장부라 양이 적어 한 번에 내려준다.
export async function getProfitLossManualEntriesAction(): Promise<ManualEntryDTO[]> {
  const rows = await prisma.profitLossManualEntry.findMany({
    orderBy: [{ billingYearMonth: "asc" }, { id: "asc" }],
  })
  return rows.map((r) => ({
    id: r.id,
    billingYearMonth: r.billingYearMonth,
    section: r.section,
    accountCode: r.accountCode,
    amount: Number(r.amount),
    memo: r.memo,
  }))
}

function firstError(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "입력값을 확인해 주세요."
}

export async function createProfitLossManualEntryAction(
  input: ProfitLossManualEntryInput,
): Promise<{ error?: string }> {
  const parsed = profitLossManualEntrySchema.safeParse(input)
  if (!parsed.success) return { error: firstError(parsed.error) }

  await prisma.profitLossManualEntry.create({ data: parsed.data })
  revalidatePath(PROFIT_LOSS_PATH)
  return {}
}

export async function updateProfitLossManualEntryAction(
  id: number,
  input: ProfitLossManualEntryInput,
): Promise<{ error?: string }> {
  const parsed = profitLossManualEntrySchema.safeParse(input)
  if (!parsed.success) return { error: firstError(parsed.error) }

  const result = await prisma.profitLossManualEntry.updateMany({ where: { id }, data: parsed.data })
  if (result.count === 0) return { error: "해당 항목을 찾을 수 없습니다. 화면을 새로고침해 주세요." }
  revalidatePath(PROFIT_LOSS_PATH)
  return {}
}

export async function deleteProfitLossManualEntryAction(id: number): Promise<{ error?: string }> {
  await prisma.profitLossManualEntry.deleteMany({ where: { id } })
  revalidatePath(PROFIT_LOSS_PATH)
  return {}
}
