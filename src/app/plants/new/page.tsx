import { PlantForm, type PlantFormDefaults } from "../plant-form"
import { createPlant } from "../actions"
import { prisma } from "@/lib/prisma"

export default async function NewPlantPage() {
  const [clientGroups, lastPlant] = await Promise.all([
    prisma.clientGroup.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.plantMaster.findFirst({
      orderBy: { constructionOrder: "desc" },
      select: { constructionOrder: true },
    }),
  ])

  const emptyPlant: PlantFormDefaults = {
    plantName: "",
    plantAlias: "",
    contractNumber: "",
    subBizNumber: "",
    kepcoContactEmail: "",
    address: "",
    capacityKw: null,
    constructionOrder: (lastPlant?.constructionOrder ?? 0) + 1,
    clientGroupId: null,
    irradianceRegion: "",
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">발전소 추가</h1>
        <p className="text-sm text-muted-foreground">
          발전소 마스터 정보를 등록합니다.
        </p>
      </div>
      <PlantForm
        action={createPlant}
        defaultValues={emptyPlant}
        clientGroups={clientGroups}
        submitLabel="등록"
      />
    </div>
  )
}
