"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { prisma } from "@/lib/prisma"
import { clientGroupFormSchema } from "@/lib/validations/client-group"
import { parseClientGroupExcel } from "@/lib/client-group-import"

export type ClientGroupActionState = {
  error?: string
  fieldErrors?: Record<string, string[]>
}

export type BulkUploadState = {
  error?: string
  result?: { created: number; updated: number; skipped: number }
}

function toNullableString(value: string | undefined) {
  return value && value.length > 0 ? value : null
}

export async function createClientGroup(
  _prevState: ClientGroupActionState,
  formData: FormData,
): Promise<ClientGroupActionState> {
  const parsed = clientGroupFormSchema.safeParse(Object.fromEntries(formData))

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
    await prisma.clientGroup.create({
      data: {
        name: data.name,
        legalName: toNullableString(data.legalName),
        bizNumber: data.bizNumber,
        ceoName: data.ceoName,
        address: toNullableString(data.address),
        bizType: toNullableString(data.bizType),
        bizItem: toNullableString(data.bizItem),
        email: toNullableString(data.email),
        mailFolders: toNullableString(data.mailFolders),
        invoiceTemplatePath: toNullableString(data.invoiceTemplatePath),
      },
    })
  } catch {
    return { error: "이미 등록된 거래처명입니다." }
  }

  revalidatePath("/plants/client-groups")
  redirect("/plants/client-groups")
}

export async function updateClientGroup(
  id: number,
  _prevState: ClientGroupActionState,
  formData: FormData,
): Promise<ClientGroupActionState> {
  const parsed = clientGroupFormSchema.safeParse(Object.fromEntries(formData))

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
    await prisma.clientGroup.update({
      where: { id },
      data: {
        name: data.name,
        legalName: toNullableString(data.legalName),
        bizNumber: data.bizNumber,
        ceoName: data.ceoName,
        address: toNullableString(data.address),
        bizType: toNullableString(data.bizType),
        bizItem: toNullableString(data.bizItem),
        email: toNullableString(data.email),
        mailFolders: toNullableString(data.mailFolders),
        invoiceTemplatePath: toNullableString(data.invoiceTemplatePath),
      },
    })
  } catch {
    return { error: "이미 등록된 거래처명입니다." }
  }

  revalidatePath("/plants/client-groups")
  redirect("/plants/client-groups")
}

export type CreateClientGroupQuickState = {
  error?: string
  fieldErrors?: Record<string, string[]>
  clientGroup?: { id: number; name: string }
}

export async function createClientGroupQuick(
  _prevState: CreateClientGroupQuickState,
  formData: FormData,
): Promise<CreateClientGroupQuickState> {
  const parsed = clientGroupFormSchema.safeParse(Object.fromEntries(formData))

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
    const clientGroup = await prisma.clientGroup.create({
      data: {
        name: data.name,
        legalName: toNullableString(data.legalName),
        bizNumber: data.bizNumber,
        ceoName: data.ceoName,
        address: toNullableString(data.address),
        bizType: toNullableString(data.bizType),
        bizItem: toNullableString(data.bizItem),
        email: toNullableString(data.email),
      },
      select: { id: true, name: true },
    })

    revalidatePath("/plants/client-groups")
    revalidatePath("/plants")

    return { clientGroup }
  } catch {
    return { error: "이미 등록된 거래처명입니다." }
  }
}

export async function deleteClientGroup(id: number) {
  await prisma.clientGroup.delete({ where: { id } })
  revalidatePath("/plants/client-groups")
}

export async function bulkUploadClientGroupsAction(
  _prevState: BulkUploadState,
  formData: FormData,
): Promise<BulkUploadState> {
  const file = formData.get("file")
  if (!(file instanceof File) || file.size === 0) {
    return { error: "업로드할 엑셀 파일을 선택해 주세요." }
  }

  let parsed: ReturnType<typeof parseClientGroupExcel>
  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    parsed = parseClientGroupExcel(buffer)
  } catch {
    return { error: "엑셀 파일을 읽지 못했습니다. 파일 형식을 확인해 주세요." }
  }

  let created = 0
  let updated = 0

  for (const row of parsed.rows) {
    const data = {
      legalName: row.legalName,
      bizNumber: row.bizNumber,
      ceoName: row.ceoName,
      address: row.address,
      bizType: row.bizType,
      bizItem: row.bizItem,
      email: row.email,
    }

    const existing = await prisma.clientGroup.findUnique({
      where: { name: row.name },
    })

    if (existing) {
      await prisma.clientGroup.update({ where: { id: existing.id }, data })
      updated++
    } else {
      await prisma.clientGroup.create({ data: { name: row.name, ...data } })
      created++
    }
  }

  revalidatePath("/plants/client-groups")
  return {
    result: { created, updated, skipped: parsed.skipped },
  }
}
