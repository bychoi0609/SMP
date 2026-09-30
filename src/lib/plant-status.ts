import type { Prisma } from "@/generated/prisma/client"

// 발전소 운영상태. 폐지(CLOSED) 발전소는 SMP·REC 월 작업 표에서 숨기되,
// 발전소관리·리포트 등 과거 기록 화면에는 그대로 남긴다.
export const PLANT_OPERATING_STATUSES = ["ACTIVE", "SUSPENDED", "CLOSED"] as const
export type PlantOperatingStatusValue = (typeof PLANT_OPERATING_STATUSES)[number]

export const PLANT_OPERATING_STATUS_LABEL: Record<PlantOperatingStatusValue, string> = {
  ACTIVE: "운영",
  SUSPENDED: "정지",
  CLOSED: "폐지",
}

// 엑셀 업로드용: "운영/정지/폐지" 라벨을 값으로 바꾼다. 알 수 없는 값이면 null.
export function parsePlantOperatingStatusLabel(
  label: string,
): PlantOperatingStatusValue | null {
  const entry = Object.entries(PLANT_OPERATING_STATUS_LABEL).find(
    ([, value]) => value === label,
  )
  return entry ? (entry[0] as PlantOperatingStatusValue) : null
}

// 월 작업 표(SMP 수집·REC)에 보여줄 발전소 조건. 폐지 발전소라도 해당 귀속월에
// 이미 SMP 데이터가 있으면(폐지 전 달) 그 달 작업을 마칠 수 있도록 계속 보여준다.
export function visiblePlantWhere(
  billingYearMonth: string,
): Prisma.PlantMasterWhereInput {
  return {
    OR: [
      { operatingStatus: { not: "CLOSED" } },
      { smpMonthlies: { some: { billingYearMonth } } },
    ],
  }
}
