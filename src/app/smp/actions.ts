"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { prisma } from "@/lib/prisma"
import type { Prisma } from "@/generated/prisma/client"
import { scanKepcoNotices, type ScanResult } from "@/lib/kepco-mail"
import { plantFormSchema } from "@/lib/validations/plant"
import { smpReportCellSchema } from "@/lib/validations/smp"
import { representativePriceFormSchema } from "@/lib/validations/rec"
import { IRRADIANCE_REGIONS, isIrradianceRegion } from "@/lib/irradiance-regions"
import {
  buildSmpReportExportWorkbook,
  type SmpReportExportRow,
} from "@/lib/smp-report-export"
import {
  generateInvoiceFile,
  type GenerateInvoiceResult,
} from "@/lib/invoice-generate"
import type { PlantActionState } from "../plants/actions"

export type ScanActionState = {
  result?: ScanResult
  error?: string
}

export async function scanMailAction(
  targetMonth: string,
  clientGroupId?: number,
): Promise<ScanActionState> {
  try {
    const result = await scanKepcoNotices(targetMonth, clientGroupId)
    revalidatePath("/smp")
    revalidatePath("/") // 대시보드 미발행 건수 갱신
    return { result }
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "메일 확인 중 오류가 발생했습니다.",
    }
  }
}

export async function assignPlantAction(
  smpMonthlyId: number,
  plantId: number,
) {
  await prisma.smpMonthly.update({
    where: { id: smpMonthlyId },
    data: { plantId, parseStatus: "OK" },
  })
  revalidatePath("/smp")
  revalidatePath("/")
}

// 검토필요 행을 신규 발전소로 등록하면서 곧바로 연결한다. 메일에서 추출해둔
// 계약번호/종사업장번호/주소/용량은 폼 기본값으로만 쓰이고, 거래처처럼 메일에
// 없는 정보는 사용자가 직접 입력한 값을 그대로 신뢰한다.
export async function createPlantFromSmpAction(
  smpMonthlyId: number,
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
    const plant = await prisma.plantMaster.create({
      data: {
        plantName: data.plantName,
        plantAlias: data.plantAlias || null,
        contractNumber: data.contractNumber || null,
        subBizNumber: data.subBizNumber || null,
        kepcoContactEmail: data.kepcoContactEmail || null,
        address: data.address || null,
        capacityKw: data.capacityKw ?? null,
        constructionOrder: data.constructionOrder,
        clientGroupId: data.clientGroupId,
      },
    })
    await prisma.smpMonthly.update({
      where: { id: smpMonthlyId },
      data: { plantId: plant.id, parseStatus: "OK" },
    })
  } catch {
    return { error: "계약번호가 이미 등록되어 있습니다. 계약번호를 확인해 주세요." }
  }

  revalidatePath("/plants")
  revalidatePath("/")
  redirect("/smp")
}

export type BulkCreatePlantsState = {
  error?: string
  result?: {
    created: number
    skipped: number
    skippedDetails: string[]
  }
}

// 검토필요 행 여러 건을 한 번에 신규 발전소로 등록한다. 발전소명/계약번호/
// 종사업장번호는 메일에서 추출된 값을 그대로 쓰고, 거래처만 사용자가 선택한
// 하나의 값을 전체에 공통 적용한다(REC 기준단가 일괄 적용과 동일한 방식).
// 건설순서는 마지막 발전소 순번 뒤로 이어서 순차 부여한다.
export async function bulkCreatePlantsFromSmpAction(
  smpMonthlyIds: number[],
  clientGroupId: number,
): Promise<BulkCreatePlantsState> {
  if (smpMonthlyIds.length === 0) {
    return { error: "선택된 항목이 없습니다." }
  }
  if (!clientGroupId) {
    return { error: "거래처를 선택해 주세요." }
  }

  const rows = await prisma.smpMonthly.findMany({
    where: { id: { in: smpMonthlyIds }, parseStatus: "NEEDS_REVIEW" },
  })

  const lastPlant = await prisma.plantMaster.findFirst({
    orderBy: { constructionOrder: "desc" },
    select: { constructionOrder: true },
  })
  let nextOrder = (lastPlant?.constructionOrder ?? 0) + 1

  let created = 0
  const skippedDetails: string[] = []

  for (const row of rows) {
    const label = row.extractedPlantName ?? `(귀속월 ${row.billingYearMonth})`

    if (!row.extractedPlantName || !row.extractedContractNumber || !row.extractedSubBizNumber) {
      skippedDetails.push(`${label} - 계약번호/종사업장번호 추출 실패`)
      continue
    }

    try {
      const plant = await prisma.plantMaster.create({
        data: {
          plantName: row.extractedPlantName,
          contractNumber: row.extractedContractNumber,
          subBizNumber: row.extractedSubBizNumber,
          kepcoContactEmail: row.extractedKepcoContactEmail || null,
          address: row.extractedAddress || null,
          capacityKw: row.extractedCapacityKw ?? null,
          constructionOrder: nextOrder,
          clientGroupId,
        },
      })
      nextOrder += 1
      await prisma.smpMonthly.update({
        where: { id: row.id },
        data: { plantId: plant.id, parseStatus: "OK" },
      })
      created += 1
    } catch {
      skippedDetails.push(`${label} - 계약번호 중복`)
    }
  }

  revalidatePath("/smp")
  revalidatePath("/plants")
  revalidatePath("/")

  return { result: { created, skipped: skippedDetails.length, skippedDetails } }
}

export type ReportRow = {
  plantId: number
  generationKwh: number | null
  smpUnitPrice: number | null
  supplyAmount: number | null
  recQuantity: number | null
  recUnitPrice: number | null
  recAmount: number | null
  recStatus: "TENTATIVE" | "CONFIRMED" | null
}

export type ReportPlant = {
  id: number
  plantName: string
  plantAlias: string | null
  capacityKw: number | null
  irradianceRegion: string | null
  contractNumber: string | null
}

// 보고서 모달에 표시할 발전소 목록. 해당 귀속월에 실제로 수집된(파싱 성공)
// SMP 데이터가 정확히 한 거래처 소속 발전소들뿐이면, 데이터를 수집할 때
// 대상으로 삼았던 그 거래처의 발전소 전체(수기 입력 대상 포함)를 보여준다.
// 데이터가 없거나 여러 거래처가 섞여 있으면 SMP 페이지에서 선택된 거래처
// 필터(fallbackClientGroupId)를 그대로 따른다.
export async function getReportPlantsAction(
  billingYearMonth: string,
  fallbackClientGroupId?: number,
): Promise<ReportPlant[]> {
  const collectedRows = await prisma.smpMonthly.findMany({
    where: { billingYearMonth, parseStatus: "OK", plantId: { not: null } },
    select: { plant: { select: { clientGroupId: true } } },
  })
  const collectedClientGroupIds = [
    ...new Set(
      collectedRows
        .map((row) => row.plant?.clientGroupId)
        .filter((id): id is number => id != null),
    ),
  ]

  const where: Prisma.PlantMasterWhereInput = {}
  if (collectedClientGroupIds.length === 1) {
    where.clientGroupId = collectedClientGroupIds[0]
  } else if (fallbackClientGroupId) {
    where.clientGroupId = fallbackClientGroupId
  }

  const plants = await prisma.plantMaster.findMany({
    where,
    orderBy: { constructionOrder: "asc" },
    select: {
      id: true,
      plantName: true,
      plantAlias: true,
      capacityKw: true,
      irradianceRegion: true,
      contractNumber: true,
    },
  })

  return plants.map((plant) => ({
    ...plant,
    capacityKw: plant.capacityKw ? Number(plant.capacityKw) : null,
  }))
}

// 보고서 모달의 귀속월별 발전소 데이터셀 채우기용. SMP는 파싱 성공(OK) 건만,
// REC는 발전소별 오버라이드가 반영된 값을 그대로 사용한다.
export async function getSmpReportRowsAction(
  billingYearMonth: string,
): Promise<ReportRow[]> {
  const [smpRows, recRows] = await Promise.all([
    prisma.smpMonthly.findMany({
      where: { billingYearMonth, parseStatus: "OK", plantId: { not: null } },
    }),
    prisma.recMonthly.findMany({ where: { billingYearMonth } }),
  ])

  const recByPlant = new Map(recRows.map((r) => [r.plantId, r]))

  return smpRows.map((row) => {
    const rec = recByPlant.get(row.plantId!)
    return {
      plantId: row.plantId!,
      generationKwh: row.generationKwh ? Number(row.generationKwh) : null,
      smpUnitPrice: row.smpUnitPrice ? Number(row.smpUnitPrice) : null,
      supplyAmount: row.supplyAmount ? Number(row.supplyAmount) : null,
      recQuantity: rec ? Number(rec.quantity) : null,
      recUnitPrice: rec ? Number(rec.unitPrice) : null,
      recAmount: rec ? Number(rec.amount) : null,
      recStatus: rec ? rec.status : null,
    }
  })
}

type SmpReportField = "generationKwh" | "smpUnitPrice" | "supplyAmount"

// 보고서 모달에서 SMP 데이터셀을 직접 수정할 때 사용. 해당 발전소·귀속월의
// SmpMonthly 행이 없으면 새로 만든다(전력거래소 발전소처럼 메일 수집 없이
// 발전량 등을 수기로 입력하는 경우를 지원하기 위함).
export async function updateSmpReportCellAction(
  plantId: number,
  billingYearMonth: string,
  field: SmpReportField,
  rawValue: number,
): Promise<{ error?: string }> {
  const parsed = smpReportCellSchema.safeParse({ value: rawValue })
  if (!parsed.success) {
    return { error: "숫자를 입력해 주세요." }
  }

  try {
    await prisma.smpMonthly.upsert({
      where: { plantId_billingYearMonth: { plantId, billingYearMonth } },
      update: { [field]: parsed.data.value },
      create: {
        plantId,
        billingYearMonth,
        parseStatus: "OK",
        [field]: parsed.data.value,
      },
    })
  } catch {
    return { error: "저장에 실패했습니다." }
  }

  revalidatePath("/smp")
  revalidatePath("/reports")
  revalidatePath("/")
  return {}
}

// 보고서 모달의 "수평면 일사량" 편집 화면용. 지역이 아직 입력되지 않았어도
// 10개 지역 전체를 항상 반환한다(빈 값은 null).
export async function getSolarIrradianceMonthlyAction(
  billingYearMonth: string,
): Promise<Record<string, number | null>> {
  const rows = await prisma.solarIrradianceMonthly.findMany({
    where: { billingYearMonth, region: { in: [...IRRADIANCE_REGIONS] } },
  })
  const byRegion = new Map(rows.map((r) => [r.region, Number(r.value)]))
  return Object.fromEntries(
    IRRADIANCE_REGIONS.map((region) => [region, byRegion.get(region) ?? null]),
  )
}

export async function upsertSolarIrradianceMonthlyAction(
  billingYearMonth: string,
  region: string,
  rawValue: number,
): Promise<{ error?: string }> {
  if (!isIrradianceRegion(region)) {
    return { error: "알 수 없는 지역입니다." }
  }
  const parsed = smpReportCellSchema.safeParse({ value: rawValue })
  if (!parsed.success) {
    return { error: "숫자를 입력해 주세요." }
  }

  await prisma.solarIrradianceMonthly.upsert({
    where: { region_billingYearMonth: { region, billingYearMonth } },
    update: { value: parsed.data.value },
    create: { region, billingYearMonth, value: parsed.data.value },
  })

  revalidatePath("/smp")
  revalidatePath("/reports")
  return {}
}

// 보고서 모달의 "REC단가 일괄적용" 입력창에 표시할 해당 월 대표(기준) 단가.
// /rec 화면과 동일한 RecMonthlyDefault를 공유한다.
export async function getRecDefaultPriceAction(
  billingYearMonth: string,
): Promise<number | null> {
  const row = await prisma.recMonthlyDefault.findUnique({
    where: { billingYearMonth },
  })
  return row ? Number(row.baseUnitPrice) : null
}

// 보고서 모달에서 REC단가를 한 번에 입력해 화면에 표시된 발전소 전체에
// 적용한다. 대표 단가는 /rec 화면과 공유하는 RecMonthlyDefault에 저장하고,
// 각 발전소의 REC단가는 갱신하되 수량은 (실제 입력값이 있으면 그 값을,
// 없으면 SMP 발전량 기반 예상치를) 그대로 유지해 덮어쓰지 않는다. 이후
// 발전소별 수기 수정은 이 값을 다시 덮어쓸 수 있다.
export async function applyRecUnitPriceToAllAction(
  billingYearMonth: string,
  rawUnitPrice: number,
  quantities: { plantId: number; quantity: number }[],
): Promise<{ error?: string }> {
  const parsed = representativePriceFormSchema.safeParse({
    baseUnitPrice: rawUnitPrice,
  })
  if (!parsed.success) {
    return { error: "숫자를 입력해 주세요." }
  }
  const unitPrice = parsed.data.baseUnitPrice

  await prisma.$transaction([
    prisma.recMonthlyDefault.upsert({
      where: { billingYearMonth },
      update: { baseUnitPrice: unitPrice },
      create: { billingYearMonth, baseUnitPrice: unitPrice },
    }),
    ...quantities.map(({ plantId, quantity }) =>
      prisma.recMonthly.upsert({
        where: { plantId_billingYearMonth: { plantId, billingYearMonth } },
        update: { unitPrice, amount: quantity * unitPrice },
        create: {
          plantId,
          billingYearMonth,
          quantity,
          unitPrice,
          amount: quantity * unitPrice,
        },
      }),
    ),
  ])

  revalidatePath("/smp")
  revalidatePath("/rec")
  revalidatePath("/reports")
  revalidatePath("/")
  return {}
}

export type ExportSmpReportResult = { base64: string } | { error: string }

// 보고서 모달에 현재 표시된 데이터를 한전 월 데이터 양식지 그대로 엑셀로
// 내보낸다. 모달에서 이미 계산된 값을 그대로 받아 화면에 보이는 것과
// 동일한 결과가 나오도록 한다.
export async function exportSmpReportAction(
  rows: SmpReportExportRow[],
): Promise<ExportSmpReportResult> {
  try {
    const buffer = await buildSmpReportExportWorkbook(rows)
    return { base64: buffer.toString("base64") }
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "엑셀 파일을 만들지 못했습니다.",
    }
  }
}

// "더보기" 메뉴의 "세금계산서" 항목용. 발행 이력을 추적하지 않고, 누를 때마다
// 거래처에 등록된 양식(.xls)에 현재 SMP 데이터를 채운 파일을 즉시 만들어
// base64로 돌려준다(클라이언트에서 바로 다운로드).
export async function generateInvoiceAction(
  clientGroupId: number,
  billingYearMonth: string,
): Promise<GenerateInvoiceResult> {
  try {
    return await generateInvoiceFile(clientGroupId, billingYearMonth)
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "세금계산서 파일 생성 중 오류가 발생했습니다.",
    }
  }
}

// 수집된 SMP 데이터 전체 초기화. 이미 "발행완료" 처리된 데이터는 세금계산서
// 이력이 사라지면 안 되므로 대상에서 제외한다.
export async function resetSmpDataAction(): Promise<{ deleted: number }> {
  const { count } = await prisma.smpMonthly.deleteMany({
    where: { taxInvoiceStatus: { not: "ISSUED" } },
  })
  revalidatePath("/smp")
  revalidatePath("/")
  return { deleted: count }
}

// "SMP 데이터 수집" 화면에서 특정 거래처를 선택했을 때 보여줄 발전소 목록.
// getReportPlantsAction과 달리 사용자가 고른 거래처를 그대로 따르며(자동
// 추정 없음), 확정 단위(거래처+귀속월)와 항상 일치시킨다.
export async function getCollectionPlantsAction(
  clientGroupId: number,
  query?: string,
): Promise<ReportPlant[]> {
  const plants = await prisma.plantMaster.findMany({
    where: {
      clientGroupId,
      ...(query
        ? { OR: [{ plantName: { contains: query } }, { plantAlias: { contains: query } }] }
        : {}),
    },
    orderBy: { constructionOrder: "asc" },
    select: {
      id: true,
      plantName: true,
      plantAlias: true,
      capacityKw: true,
      irradianceRegion: true,
      contractNumber: true,
    },
  })

  return plants.map((plant) => ({
    ...plant,
    capacityKw: plant.capacityKw ? Number(plant.capacityKw) : null,
  }))
}

export type SmpCollectionStatusValue = "DRAFT" | "CONFIRMED"

// 거래처+귀속월 단위 확정 상태 조회. 확정 이력이 아직 없으면 작업중(DRAFT)으로 본다.
export async function getSmpCollectionStatusAction(
  clientGroupId: number,
  billingYearMonth: string,
): Promise<SmpCollectionStatusValue> {
  const row = await prisma.smpMonthlyConfirmation.findUnique({
    where: {
      clientGroupId_billingYearMonth: { clientGroupId, billingYearMonth },
    },
  })
  return row?.status ?? "DRAFT"
}

// 해당 거래처+귀속월 데이터 수집을 확정한다. 확정되면 이 조합에 속한 발전소의
// SmpMonthly 데이터가 "REC" 탭에 누적 표시된다.
export async function confirmSmpCollectionAction(
  clientGroupId: number,
  billingYearMonth: string,
): Promise<{ error?: string }> {
  await prisma.smpMonthlyConfirmation.upsert({
    where: {
      clientGroupId_billingYearMonth: { clientGroupId, billingYearMonth },
    },
    update: { status: "CONFIRMED", confirmedAt: new Date() },
    create: {
      clientGroupId,
      billingYearMonth,
      status: "CONFIRMED",
      confirmedAt: new Date(),
    },
  })
  revalidatePath("/smp")
  revalidatePath("/rec")
  revalidatePath("/reports")
  revalidatePath("/")
  return {}
}

// 확정을 취소하고 다시 작업중(DRAFT) 상태로 되돌린다 — 재수정 전 반드시 거쳐야 함.
// 확정 취소되면 REC 탭에서도 해당 조합이 즉시 사라진다.
export async function unconfirmSmpCollectionAction(
  clientGroupId: number,
  billingYearMonth: string,
): Promise<{ error?: string }> {
  await prisma.smpMonthlyConfirmation.upsert({
    where: {
      clientGroupId_billingYearMonth: { clientGroupId, billingYearMonth },
    },
    update: { status: "DRAFT", confirmedAt: null },
    create: { clientGroupId, billingYearMonth, status: "DRAFT" },
  })
  revalidatePath("/smp")
  revalidatePath("/rec")
  revalidatePath("/reports")
  revalidatePath("/")
  return {}
}
