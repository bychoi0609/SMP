import type { Prisma } from "@/generated/prisma/client"
import type { ReportPlant } from "@/app/smp/actions"

// ReportPlant를 채우는 발전소 select — SMP 수집·REC 화면이 같은 필드를 쓴다.
export const REPORT_PLANT_SELECT = {
  id: true,
  plantName: true,
  plantAlias: true,
  capacityKw: true,
  irradianceRegion: true,
  contractNumber: true,
  recWeight: true,
  operatingStatus: true,
} satisfies Prisma.PlantMasterSelect

export function toReportPlant(
  plant: Prisma.PlantMasterGetPayload<{ select: typeof REPORT_PLANT_SELECT }>,
): ReportPlant {
  return {
    ...plant,
    capacityKw: plant.capacityKw ? Number(plant.capacityKw) : null,
    recWeight: Number(plant.recWeight),
  }
}
