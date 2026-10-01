"use server"

import { revalidatePath } from "next/cache"

import { prisma } from "@/lib/prisma"
import { Prisma } from "@/generated/prisma/client"
import { estimateRecQuantity } from "@/lib/rec-quantity"
import {
  recRowFormSchema,
  representativePriceFormSchema,
} from "@/lib/validations/rec"

// REC 행 하나의 저장 결과. 클라이언트 표(ReportRow)에 그대로 덮어쓴다.
export type RecRowPatch = {
  plantId: number
  recQuantity: number
  recUnitPrice: number
  recAmount: number
  recStatus: "TENTATIVE" | "CONFIRMED"
  recQuantityIsActual: boolean
  recUnitPriceIsManual: boolean
}

type RecRecord = {
  plantId: number
  quantity: unknown
  unitPrice: unknown
  amount: unknown
  status: "TENTATIVE" | "CONFIRMED"
  quantityIsActual: boolean
  unitPriceIsManual: boolean
}

function toPatch(rec: RecRecord): RecRowPatch {
  return {
    plantId: rec.plantId,
    recQuantity: Number(rec.quantity),
    recUnitPrice: Number(rec.unitPrice),
    recAmount: Number(rec.amount),
    recStatus: rec.status,
    recQuantityIsActual: rec.quantityIsActual,
    recUnitPriceIsManual: rec.unitPriceIsManual,
  }
}

function revalidateRec() {
  revalidatePath("/rec")
  revalidatePath("/smp")
  revalidatePath("/reports")
  revalidatePath("/")
}

function previousMonthOf(billingYearMonth: string): string {
  const [year, month] = billingYearMonth.split("-").map(Number)
  const d = new Date(year, month - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

// 발전소별로 화면에 보이는 수량을 서버에서 다시 구한다(grid-shared의
// getDisplayRecQuantity와 같은 규칙). 실제 발급량이거나 확정된 행은 저장된 수량,
// 아니면 발전량 기반 예상치, 발전량도 없으면 0.
async function loadRecTargets(billingYearMonth: string, plantIds: number[]) {
  const [plants, smpRows, recRows] = await Promise.all([
    prisma.plantMaster.findMany({
      where: { id: { in: plantIds } },
      select: { id: true, recWeight: true },
    }),
    prisma.smpMonthly.findMany({
      where: { billingYearMonth, parseStatus: "OK", plantId: { in: plantIds } },
      select: { plantId: true, generationKwh: true },
    }),
    prisma.recMonthly.findMany({
      where: { billingYearMonth, plantId: { in: plantIds } },
    }),
  ])
  const generationByPlant = new Map(
    smpRows.map((r) => [r.plantId!, r.generationKwh ? Number(r.generationKwh) : null]),
  )
  const recByPlant = new Map(recRows.map((r) => [r.plantId, r]))

  return plants.map((plant) => {
    const rec = recByPlant.get(plant.id) ?? null
    const generationKwh = generationByPlant.get(plant.id) ?? null
    const estimate =
      generationKwh !== null
        ? estimateRecQuantity(generationKwh, Number(plant.recWeight))
        : 0
    const quantity =
      rec && (rec.quantityIsActual || rec.status === "CONFIRMED")
        ? Number(rec.quantity)
        : estimate
    return { plantId: plant.id, rec, quantity, estimate, hasGeneration: generationKwh !== null }
  })
}

type RecUpsertRow = {
  plantId: number
  quantity: number
  unitPrice: number
  status: "TENTATIVE" | "CONFIRMED"
  quantityIsActual: boolean
  unitPriceIsManual: boolean
}

// 여러 발전소의 REC 행을 SQL 한 번(INSERT ... ON CONFLICT)으로 저장한다.
// 발전소마다 upsert를 보내면 원격 DB 왕복이 발전소 수만큼 쌓여 트랜잭션 제한(5초)을
// 넘기므로, 값은 호출부에서 모두 정해 넘기고 여기서는 한 번에 쓴다.
function bulkUpsertRecRows(billingYearMonth: string, rows: RecUpsertRow[]) {
  const values = rows.map(
    (r) => Prisma.sql`(${r.plantId}, ${billingYearMonth}, ${r.quantity}, ${r.unitPrice},
      ${r.quantity * r.unitPrice}, ${r.status}::"rec_status", ${r.quantityIsActual},
      ${r.unitPriceIsManual}, now())`,
  )
  return prisma.$executeRaw`
    INSERT INTO "rec_monthly" ("plantId", "billingYearMonth", "quantity", "unitPrice",
      "amount", "status", "quantityIsActual", "unitPriceIsManual", "updatedAt")
    VALUES ${Prisma.join(values)}
    ON CONFLICT ("plantId", "billingYearMonth") DO UPDATE SET
      "quantity" = EXCLUDED."quantity",
      "unitPrice" = EXCLUDED."unitPrice",
      "amount" = EXCLUDED."amount",
      "status" = EXCLUDED."status",
      "quantityIsActual" = EXCLUDED."quantityIsActual",
      "unitPriceIsManual" = EXCLUDED."unitPriceIsManual",
      "updatedAt" = EXCLUDED."updatedAt"`
}

async function loadRecPatches(billingYearMonth: string, plantIds: number[]) {
  const rows = await prisma.recMonthly.findMany({
    where: { billingYearMonth, plantId: { in: plantIds } },
  })
  return rows.map(toPatch)
}

// 표에서 REC 수량·단가 셀 하나를 저장한다.
// - markQuantityActual: 수량을 직접 입력함 → 실제 발급량으로 표시, 발전량이 바뀌어도 유지.
// - markPriceManual: 단가를 직접 입력함 → 개별 단가로 표시, 대표단가 적용에서 제외.
// - confirm: 행을 확정한다(REC 탭에서 단가를 입력한 경우).
// 어느 옵션도 기존 값을 되돌리지는 않는다 — 확정된 행을 고쳐도 확정은 유지된다.
export async function upsertRecRowAction(
  plantId: number,
  billingYearMonth: string,
  rawQuantity: number,
  rawUnitPrice: number,
  options: {
    markQuantityActual?: boolean
    markPriceManual?: boolean
    confirm?: boolean
  } = {},
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
  const flags = {
    ...(options.markQuantityActual ? { quantityIsActual: true } : {}),
    ...(options.markPriceManual ? { unitPriceIsManual: true } : {}),
    ...(options.confirm ? { status: "CONFIRMED" as const } : {}),
  }

  await prisma.recMonthly.upsert({
    where: { plantId_billingYearMonth: { plantId, billingYearMonth } },
    update: { quantity, unitPrice, amount, ...flags },
    create: { plantId, billingYearMonth, quantity, unitPrice, amount, ...flags },
  })

  revalidateRec()
  return {}
}

// 해당 월 대표(기준) REC 단가.
export async function getRecDefaultPriceAction(
  billingYearMonth: string,
): Promise<number | null> {
  const row = await prisma.recMonthlyDefault.findUnique({
    where: { billingYearMonth },
  })
  return row ? Number(row.baseUnitPrice) : null
}

export type ApplyRecDefaultPriceResult =
  | { error: string }
  | {
      patches: RecRowPatch[]
      appliedCount: number // 대표단가가 들어간 발전소
      carriedCount: number // 지난달 개별 단가를 이어받은 발전소
      keptCount: number // 이미 개별 단가라 그대로 둔 발전소
    }

// 대표단가를 저장하고 화면에 보이는 발전소에 적용한다.
// - 이미 개별 단가인 행은 그대로 둔다.
// - 이번 달 단가가 아직 없고 지난달에 개별 단가였던 발전소는 그 단가를 이어받는다.
// - 나머지는 대표단가로 채운다. 수량은 화면에 보이는 값을 그대로 쓰고, 확정 상태는 건드리지 않는다.
export async function applyRecDefaultPriceAction(
  billingYearMonth: string,
  rawUnitPrice: number,
  plantIds: number[],
): Promise<ApplyRecDefaultPriceResult> {
  const parsed = representativePriceFormSchema.safeParse({
    baseUnitPrice: rawUnitPrice,
  })
  if (!parsed.success) {
    return { error: "0보다 큰 숫자를 입력해 주세요." }
  }
  const defaultPrice = parsed.data.baseUnitPrice

  const [targets, previousManual] = await Promise.all([
    loadRecTargets(billingYearMonth, plantIds),
    prisma.recMonthly.findMany({
      where: {
        billingYearMonth: previousMonthOf(billingYearMonth),
        plantId: { in: plantIds },
        unitPriceIsManual: true,
      },
      select: { plantId: true, unitPrice: true },
    }),
  ])
  const previousManualPrice = new Map(
    previousManual.map((r) => [r.plantId, Number(r.unitPrice)]),
  )

  let appliedCount = 0
  let carriedCount = 0
  let keptCount = 0
  const writes: RecUpsertRow[] = []
  for (const { plantId, rec, quantity } of targets) {
    if (rec?.unitPriceIsManual) {
      keptCount += 1
      continue
    }
    const hasPrice = rec !== null && Number(rec.unitPrice) > 0
    const carried = !hasPrice ? previousManualPrice.get(plantId) : undefined
    const unitPrice = carried ?? defaultPrice
    const unitPriceIsManual = carried !== undefined
    if (unitPriceIsManual) carriedCount += 1
    else appliedCount += 1

    // 확정 상태와 실제 발급량 표시는 기존 값을 그대로 둔다.
    writes.push({
      plantId,
      quantity,
      unitPrice,
      status: rec?.status ?? "TENTATIVE",
      quantityIsActual: rec?.quantityIsActual ?? false,
      unitPriceIsManual,
    })
  }

  await prisma.$transaction([
    prisma.recMonthlyDefault.upsert({
      where: { billingYearMonth },
      update: { baseUnitPrice: defaultPrice },
      create: { billingYearMonth, baseUnitPrice: defaultPrice },
    }),
    ...(writes.length > 0 ? [bulkUpsertRecRows(billingYearMonth, writes)] : []),
  ])

  revalidateRec()
  return {
    patches: await loadRecPatches(
      billingYearMonth,
      writes.map((w) => w.plantId),
    ),
    appliedCount,
    carriedCount,
    keptCount,
  }
}

export type SetRecConfirmedResult =
  | { error: string }
  | { patches: RecRowPatch[]; skippedCount: number }

// 여러 발전소의 REC를 한 번에 확정하거나 확정 취소한다.
// - 확정: 단가가 있거나 수량이 0인 행만 확정하고, 그때 보이는 수량을 저장해 고정한다.
//   단가가 없는 행(또는 발전량·REC 데이터가 모두 없는 발전소)은 건너뛰고 그 개수를 돌려준다.
// - 확정 취소: 상태만 잠정으로 되돌린다. 수량·단가와 실제 발급량/개별 단가 표시는 그대로.
export async function setRecConfirmedAction(
  billingYearMonth: string,
  plantIds: number[],
  confirmed: boolean,
): Promise<SetRecConfirmedResult> {
  if (!confirmed) {
    await prisma.recMonthly.updateMany({
      where: { billingYearMonth, plantId: { in: plantIds }, status: "CONFIRMED" },
      data: { status: "TENTATIVE" },
    })
    revalidateRec()
    return { patches: await loadRecPatches(billingYearMonth, plantIds), skippedCount: 0 }
  }

  const targets = await loadRecTargets(billingYearMonth, plantIds)
  let skippedCount = 0
  const writes: RecUpsertRow[] = []
  for (const { plantId, rec, quantity, hasGeneration } of targets) {
    const unitPrice = rec ? Number(rec.unitPrice) : 0
    // 단가가 없거나, SMP 발전량도 REC 데이터도 없는 발전소는 확정하지 않는다.
    if ((quantity !== 0 && unitPrice <= 0) || (!rec && !hasGeneration)) {
      skippedCount += 1
      continue
    }
    writes.push({
      plantId,
      quantity,
      unitPrice,
      status: "CONFIRMED",
      quantityIsActual: rec?.quantityIsActual ?? false,
      unitPriceIsManual: rec?.unitPriceIsManual ?? false,
    })
  }
  if (writes.length > 0) await bulkUpsertRecRows(billingYearMonth, writes)

  revalidateRec()
  return {
    patches: await loadRecPatches(
      billingYearMonth,
      writes.map((w) => w.plantId),
    ),
    skippedCount,
  }
}

export type ResetRecResult = { error: string } | { patch: RecRowPatch }

// 실제 발급량 표시를 지우고 발전량 기반 예상치로 되돌린다(확정된 행이면 수량도 예상치로 바꿈).
export async function resetRecQuantityAction(
  plantId: number,
  billingYearMonth: string,
): Promise<ResetRecResult> {
  const [target] = await loadRecTargets(billingYearMonth, [plantId])
  if (!target?.rec) return { error: "REC 데이터가 없습니다." }

  const unitPrice = Number(target.rec.unitPrice)
  const saved = await prisma.recMonthly.update({
    where: { plantId_billingYearMonth: { plantId, billingYearMonth } },
    data: {
      quantity: target.estimate,
      amount: target.estimate * unitPrice,
      quantityIsActual: false,
    },
  })

  revalidateRec()
  return { patch: toPatch(saved) }
}

// 개별 단가 표시를 지우고 해당 월 대표단가로 되돌린다.
export async function resetRecPriceAction(
  plantId: number,
  billingYearMonth: string,
): Promise<ResetRecResult> {
  const [target, defaultPrice] = await Promise.all([
    loadRecTargets(billingYearMonth, [plantId]).then((t) => t[0]),
    getRecDefaultPriceAction(billingYearMonth),
  ])
  if (defaultPrice === null) return { error: "대표단가를 먼저 입력해 주세요." }
  if (!target?.rec) return { error: "REC 데이터가 없습니다." }

  const saved = await prisma.recMonthly.update({
    where: { plantId_billingYearMonth: { plantId, billingYearMonth } },
    data: {
      quantity: target.quantity,
      unitPrice: defaultPrice,
      amount: target.quantity * defaultPrice,
      unitPriceIsManual: false,
    },
  })

  revalidateRec()
  return { patch: toPatch(saved) }
}
