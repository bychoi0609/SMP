import Link from "next/link"
import { Building2, Pencil, Plus } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ClientGroupFilterBar } from "@/components/client-group-filter-bar"
import { prisma } from "@/lib/prisma"
import type { Prisma } from "@/generated/prisma/client"
import { getSmpContractType, SMP_CONTRACT_TYPE_LABEL } from "@/lib/smp-contract-type"
import { deletePlant } from "./actions"
import { DeletePlantButton } from "./delete-plant-button"
import { ExcelUploadDialog } from "./excel-upload-dialog"
import { ResetPlantsButton } from "./reset-plants-button"

export default async function PlantsPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; q?: string }>
}) {
  const { client: clientParam, q: qParam } = await searchParams
  const clientGroupId = clientParam ? Number(clientParam) : undefined
  const query = qParam?.trim() || undefined

  const where: Prisma.PlantMasterWhereInput = {}
  if (clientGroupId) where.clientGroupId = clientGroupId
  if (query) {
    where.OR = [
      { plantName: { contains: query } },
      { plantAlias: { contains: query } },
      { contractNumber: { contains: query } },
    ]
  }

  const [plants, clientGroupOptions] = await Promise.all([
    prisma.plantMaster.findMany({
      where,
      orderBy: [
        { clientGroup: { name: "asc" } },
        { constructionOrder: "asc" },
      ],
      include: { clientGroup: { select: { id: true, name: true } } },
    }),
    prisma.clientGroup.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ])

  const groups: { id: number; name: string; plants: typeof plants }[] = []
  for (const plant of plants) {
    let group = groups.find((g) => g.id === plant.clientGroup.id)
    if (!group) {
      group = { id: plant.clientGroup.id, name: plant.clientGroup.name, plants: [] }
      groups.push(group)
    }
    group.plants.push(plant)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">발전소 마스터 관리</h1>
          <p className="text-sm text-muted-foreground">
            총 {plants.length}개 발전소 · 건설순서 기준으로 정렬됩니다.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" render={<Link href="/plants/client-groups" />}>
            <Building2 /> 거래처 관리
          </Button>
          <ExcelUploadDialog />
          <ResetPlantsButton
            disabled={plants.length === 0}
            clientGroupId={clientGroupId}
            clientGroupName={
              clientGroupId
                ? clientGroupOptions.find((c) => c.id === clientGroupId)?.name
                : undefined
            }
          />
          <Button render={<Link href="/plants/new" />}>
            <Plus /> 발전소 추가
          </Button>
        </div>
      </div>

      <ClientGroupFilterBar
        basePath="/plants"
        clientGroups={clientGroupOptions}
        selectedClientGroupId={clientGroupId}
        query={qParam}
        searchPlaceholder="발전소명·계약번호로 검색"
      />

      {plants.length === 0 && (
        <div className="rounded-xl border">
          <div className="flex h-32 items-center justify-center text-center text-muted-foreground">
            {clientGroupId || query
              ? "검색 조건에 맞는 발전소가 없습니다."
              : (
                  <>
                    등록된 발전소가 없습니다. &quot;발전소 추가&quot; 버튼으로
                    첫 발전소를 등록해 보세요.
                  </>
                )}
          </div>
        </div>
      )}

      {groups.map((group) => (
        <div key={group.id} className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <h2 className="font-medium">{group.name}</h2>
            <span className="text-sm text-muted-foreground">
              {group.plants.length}개 발전소
            </span>
          </div>
          <div className="overflow-hidden rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14 text-center">순번</TableHead>
                  <TableHead className="w-30">발전소명</TableHead>
                  <TableHead className="w-32">계약번호</TableHead>
                  <TableHead className="w-28">SMP계약</TableHead>
                  <TableHead className="w-36">종사업장번호</TableHead>
                  <TableHead className="w-24 text-center">용량(kW)</TableHead>
                  <TableHead className="w-28 text-center">수평면 일사량</TableHead>
                  <TableHead className="w-24 text-center">관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.plants.map((plant, index) => (
                  <TableRow key={plant.id}>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {index + 1}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-center">
                        <span className="font-medium">{plant.plantName}</span>
                        {plant.plantAlias && (
                          <span className="text-xs text-muted-foreground">
                            {plant.plantAlias}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {plant.contractNumber}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const type = getSmpContractType(plant.contractNumber)
                        return (
                          <Badge variant={type === "KEPCO" ? "secondary" : "outline"}>
                            {SMP_CONTRACT_TYPE_LABEL[type]}
                          </Badge>
                        )
                      })()}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {plant.subBizNumber}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {plant.capacityKw ? plant.capacityKw.toString() : "-"}
                    </TableCell>
                    <TableCell className="text-center">
                      {plant.irradianceRegion ?? "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          render={
                            <Link
                              href={`/plants/${plant.id}/edit`}
                              aria-label={`${plant.plantName} 수정`}
                            />
                          }
                        >
                          <Pencil />
                        </Button>
                        <DeletePlantButton
                          plantId={plant.id}
                          plantName={plant.plantName}
                          action={deletePlant}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ))}
    </div>
  )
}
