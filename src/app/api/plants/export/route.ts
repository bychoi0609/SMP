import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { buildPlantExportWorkbook, type PlantExportRow } from "@/lib/plant-import"

export async function GET() {
  const plants = await prisma.plantMaster.findMany({
    orderBy: [
      { clientGroup: { name: "asc" } },
      { constructionOrder: "asc" },
    ],
    include: { clientGroup: { select: { name: true } } },
  })

  const rows: PlantExportRow[] = plants.map((plant) => ({
    plantName: plant.plantName,
    plantAlias: plant.plantAlias,
    contractNumber: plant.contractNumber,
    subBizNumber: plant.subBizNumber,
    kepcoContactEmail: plant.kepcoContactEmail,
    address: plant.address,
    capacityKw: plant.capacityKw ? Number(plant.capacityKw) : null,
    irradianceRegion: plant.irradianceRegion,
    constructionOrder: plant.constructionOrder,
    clientGroupName: plant.clientGroup.name,
  }))

  const buffer = buildPlantExportWorkbook(rows)

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(
        "발전소_목록.xlsx",
      )}`,
    },
  })
}
