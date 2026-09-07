"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { prisma } from "@/lib/prisma"
import { plantFormSchema } from "@/lib/validations/plant"
import { parsePlantExcel } from "@/lib/plant-import"

export type PlantActionState = {
  error?: string
  fieldErrors?: Record<string, string[]>
}

export type BulkUploadPlantsState = {
  error?: string
  result?: {
    created: number
    updated: number
    skipped: number
    unknownClientGroups: string[]
  }
}

function toNullableString(value: string | undefined) {
  return value && value.length > 0 ? value : null
}

export async function createPlant(
  _prevState: PlantActionState,
  formData: FormData,
): Promise<PlantActionState> {
  const parsed = plantFormSchema.safeParse(Object.fromEntries(formData))

  if (!parsed.success) {
    return {
      error: "입력값을 다시 확인해 주세요.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
    }
  }

  const data = parsed.data

  try {
    await prisma.plantMaster.create({
      data: {
        plantName: data.plantName,
        plantAlias: toNullableString(data.plantAlias),
        contractNumber: toNullableString(data.contractNumber),
        subBizNumber: toNullableString(data.subBizNumber),
        kepcoContactEmail: toNullableString(data.kepcoContactEmail),
        address: toNullableString(data.address),
        capacityKw: data.capacityKw ?? null,
        constructionOrder: data.constructionOrder,
        clientGroupId: data.clientGroupId,
        irradianceRegion: toNullableString(data.irradianceRegion),
      },
    })
  } catch {
    return { error: "계약번호가 이미 등록되어 있습니다. 계약번호를 확인해 주세요." }
  }

  revalidatePath("/plants")
  redirect("/plants")
}

export async function updatePlant(
  id: number,
  _prevState: PlantActionState,
  formData: FormData,
): Promise<PlantActionState> {
  const parsed = plantFormSchema.safeParse(Object.fromEntries(formData))

  if (!parsed.success) {
    return {
      error: "입력값을 다시 확인해 주세요.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
    }
  }

  const data = parsed.data

  try {
    await prisma.plantMaster.update({
      where: { id },
      data: {
        plantName: data.plantName,
        plantAlias: toNullableString(data.plantAlias),
        contractNumber: toNullableString(data.contractNumber),
        subBizNumber: toNullableString(data.subBizNumber),
        kepcoContactEmail: toNullableString(data.kepcoContactEmail),
        address: toNullableString(data.address),
        capacityKw: data.capacityKw ?? null,
        constructionOrder: data.constructionOrder,
        clientGroupId: data.clientGroupId,
        irradianceRegion: toNullableString(data.irradianceRegion),
      },
    })
  } catch {
    return { error: "계약번호가 이미 등록되어 있습니다. 계약번호를 확인해 주세요." }
  }

  revalidatePath("/plants")
  redirect("/plants")
}

export async function deletePlant(id: number) {
  await prisma.plantMaster.delete({ where: { id } })
  revalidatePath("/plants")
}

// 발전소 마스터 초기화. clientGroupId를 지정하면 해당 거래처 발전소만 초기화한다.
// 이미 "발행완료" 처리된 SMP 데이터가 걸린 발전소는 세금계산서 이력 보호를
// 위해 대상에서 제외한다(resetSmpDataAction과 동일한 원칙).
export async function resetPlantsDataAction(
  clientGroupId?: number,
): Promise<{ deleted: number }> {
  const protectedPlantIds = (
    await prisma.smpMonthly.findMany({
      where: { taxInvoiceStatus: "ISSUED", plantId: { not: null } },
      select: { plantId: true },
      distinct: ["plantId"],
    })
  ).map((row) => row.plantId!)

  const targetIds = (
    await prisma.plantMaster.findMany({
      where: {
        id: { notIn: protectedPlantIds },
        ...(clientGroupId ? { clientGroupId } : {}),
      },
      select: { id: true },
    })
  ).map((plant) => plant.id)

  await prisma.recMonthly.deleteMany({ where: { plantId: { in: targetIds } } })
  await prisma.smpMonthly.deleteMany({
    where: { plantId: { in: targetIds }, taxInvoiceStatus: { not: "ISSUED" } },
  })
  const { count } = await prisma.plantMaster.deleteMany({
    where: { id: { in: targetIds } },
  })

  revalidatePath("/plants")
  revalidatePath("/smp")
  revalidatePath("/rec")
  revalidatePath("/")
  return { deleted: count }
}

export async function bulkUploadPlantsAction(
  _prevState: BulkUploadPlantsState,
  formData: FormData,
): Promise<BulkUploadPlantsState> {
  const file = formData.get("file")
  if (!(file instanceof File) || file.size === 0) {
    return { error: "업로드할 엑셀 파일을 선택해 주세요." }
  }

  let parsed: ReturnType<typeof parsePlantExcel>
  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    parsed = parsePlantExcel(buffer)
  } catch {
    return { error: "엑셀 파일을 읽지 못했습니다. 파일 형식을 확인해 주세요." }
  }

  const clientGroups = await prisma.clientGroup.findMany({
    select: { id: true, name: true },
  })
  const clientGroupByName = new Map(clientGroups.map((c) => [c.name, c.id]))

  const lastPlant = await prisma.plantMaster.findFirst({
    orderBy: { constructionOrder: "desc" },
    select: { constructionOrder: true },
  })
  let nextOrder = (lastPlant?.constructionOrder ?? 0) + 1

  let created = 0
  let updated = 0
  let skipped = parsed.errors.length
  const unknownClientGroups = new Set<string>()

  for (const row of parsed.rows) {
    const clientGroupId = clientGroupByName.get(row.clientGroupName)
    if (!clientGroupId) {
      unknownClientGroups.add(row.clientGroupName)
      skipped++
      continue
    }

    const data = {
      plantName: row.plantName,
      plantAlias: row.plantAlias,
      subBizNumber: row.subBizNumber,
      kepcoContactEmail: row.kepcoContactEmail,
      address: row.address,
      capacityKw: row.capacityKw,
      irradianceRegion: row.irradianceRegion,
      clientGroupId,
    }

    // 계약번호가 없는(전력거래소) 발전소는 계약번호로 기존 발전소를 찾을 수
    // 없으므로 항상 신규 등록으로 처리한다.
    const existing = row.contractNumber
      ? await prisma.plantMaster.findUnique({
          where: { contractNumber: row.contractNumber },
        })
      : null

    if (existing) {
      await prisma.plantMaster.update({
        where: { id: existing.id },
        data: {
          ...data,
          constructionOrder: row.constructionOrder ?? existing.constructionOrder,
        },
      })
      updated++
    } else {
      const constructionOrder = row.constructionOrder ?? nextOrder++
      await prisma.plantMaster.create({
        data: {
          ...data,
          contractNumber: row.contractNumber,
          constructionOrder,
        },
      })
      created++
    }
  }

  revalidatePath("/plants")
  return {
    result: {
      created,
      updated,
      skipped,
      unknownClientGroups: [...unknownClientGroups],
    },
  }
}
