import { ClientGroupFilterBar } from "@/components/client-group-filter-bar"
import { prisma } from "@/lib/prisma"
import { NeedsReviewPanel } from "./needs-review-panel"
import { CollectWorkspacePanel } from "./collect-workspace-panel"

export default async function SmpPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; q?: string }>
}) {
  const { client: clientParam, q: qParam } = await searchParams
  const clientGroupId = clientParam ? Number(clientParam) : undefined
  const query = qParam?.trim() || undefined

  const [needsReview, plantOptions, clientGroups, lastPlant, totalSmpCount, initialPlants] =
    await Promise.all([
      prisma.smpMonthly.findMany({
        where: { parseStatus: "NEEDS_REVIEW" },
        orderBy: { createdAt: "desc" },
      }),
      prisma.plantMaster.findMany({
        orderBy: { plantName: "asc" },
        select: { id: true, plantName: true },
      }),
      prisma.clientGroup.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.plantMaster.findFirst({
        orderBy: { constructionOrder: "desc" },
        select: { constructionOrder: true },
      }),
      prisma.smpMonthly.count(),
      clientGroupId
        ? prisma.plantMaster.findMany({
            where: {
              clientGroupId,
              ...(query
                ? {
                    OR: [
                      { plantName: { contains: query } },
                      { plantAlias: { contains: query } },
                    ],
                  }
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
        : Promise.resolve([]),
    ])

  const nextConstructionOrder = (lastPlant?.constructionOrder ?? 0) + 1
  const needsReviewRows = needsReview.map((row) => ({
    id: row.id,
    extractedPlantName: row.extractedPlantName,
    extractedContractNumber: row.extractedContractNumber,
    extractedSubBizNumber: row.extractedSubBizNumber,
    extractedKepcoContactEmail: row.extractedKepcoContactEmail,
    extractedAddress: row.extractedAddress,
    extractedCapacityKw: row.extractedCapacityKw
      ? Number(row.extractedCapacityKw)
      : null,
    billingYearMonth: row.billingYearMonth,
    supplyAmount: row.supplyAmount ? Number(row.supplyAmount) : null,
    mailFolder: row.mailFolder,
  }))
  const initialPlantRows = initialPlants.map((plant) => ({
    ...plant,
    capacityKw: plant.capacityKw ? Number(plant.capacityKw) : null,
  }))

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold">SMP 데이터 수집</h1>
        <p className="text-sm text-muted-foreground">
          거래처와 기간을 선택해 한전 메일로 수집된 데이터를 검토·수정하고,
          확정하면 &quot;REC&quot; 탭에 반영됩니다.
        </p>
      </div>

      {needsReviewRows.length > 0 && (
        <NeedsReviewPanel
          rows={needsReviewRows}
          plantOptions={plantOptions}
          clientGroups={clientGroups}
          nextConstructionOrder={nextConstructionOrder}
        />
      )}

      <div className="flex flex-col gap-4">
        <ClientGroupFilterBar
          basePath="/smp"
          clientGroups={clientGroups}
          selectedClientGroupId={clientGroupId}
          query={qParam}
        />
        <CollectWorkspacePanel
          clientGroupId={clientGroupId}
          query={query}
          initialHasData={needsReview.length + totalSmpCount > 0}
          initialPlants={initialPlantRows}
        />
      </div>
    </div>
  )
}
