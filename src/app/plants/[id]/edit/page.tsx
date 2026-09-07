import { notFound } from "next/navigation"

import { prisma } from "@/lib/prisma"
import { PlantForm } from "../../plant-form"
import { updatePlant } from "../../actions"

export default async function EditPlantPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const plantId = Number(id)

  if (!Number.isInteger(plantId)) {
    notFound()
  }

  const [plant, clientGroups] = await Promise.all([
    prisma.plantMaster.findUnique({ where: { id: plantId } }),
    prisma.clientGroup.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ])

  if (!plant) {
    notFound()
  }

  const boundUpdatePlant = updatePlant.bind(null, plant.id)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">{plant.plantName} 정보 수정</h1>
        <p className="text-sm text-muted-foreground">
          발전소 마스터 정보를 수정합니다.
        </p>
      </div>
      <PlantForm
        action={boundUpdatePlant}
        defaultValues={{
          plantName: plant.plantName,
          plantAlias: plant.plantAlias ?? "",
          contractNumber: plant.contractNumber ?? "",
          subBizNumber: plant.subBizNumber ?? "",
          kepcoContactEmail: plant.kepcoContactEmail ?? "",
          address: plant.address ?? "",
          capacityKw: plant.capacityKw ? Number(plant.capacityKw) : null,
          constructionOrder: plant.constructionOrder,
          clientGroupId: plant.clientGroupId,
          irradianceRegion: plant.irradianceRegion ?? "",
        }}
        clientGroups={clientGroups}
        submitLabel="저장"
      />
    </div>
  )
}
