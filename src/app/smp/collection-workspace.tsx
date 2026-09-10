"use client"

import { useEffect, useState, useTransition } from "react"
import { FileSpreadsheet, Lock, MoreHorizontal, Sun, Unlock } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { formatAmount, formatNumber } from "@/lib/format"
import { daysInMonth, defaultBillingMonth } from "@/lib/date"
import { getSmpContractType } from "@/lib/smp-contract-type"
import { cn } from "@/lib/utils"
import {
  EDITABLE_COLUMNS,
  GridCell,
  base64ToBlob,
  downloadBlob,
  getCellConfig,
  getDisplayRecAmount,
  getDisplayRecQuantity,
  getEffectiveSmpUnitPrice,
  getGenerationHours,
  tdCell,
  thCell,
  toExportRow,
  type EditableColumn,
} from "./grid-shared"
import {
  confirmSmpCollectionAction,
  exportSmpReportAction,
  applyRecUnitPriceToAllAction,
  getCollectionPlantsAction,
  getRecDefaultPriceAction,
  getSmpCollectionStatusAction,
  getSmpReportRowsAction,
  getSolarIrradianceMonthlyAction,
  unconfirmSmpCollectionAction,
  type ReportPlant,
  type ReportRow,
  type SmpCollectionStatusValue,
} from "./actions"
import { IrradianceDialog } from "./irradiance-dialog"
import { MonthSelect } from "./month-select"

export function CollectionWorkspace({
  clientGroupId,
  query,
  initialPlants,
}: {
  clientGroupId?: number
  query?: string
  initialPlants: ReportPlant[]
}) {
  const [month, setMonth] = useState(defaultBillingMonth)
  const [plants, setPlants] = useState<ReportPlant[]>(initialPlants)
  const [rows, setRows] = useState<Map<number, ReportRow>>(new Map())
  const [status, setStatus] = useState<SmpCollectionStatusValue>("DRAFT")
  const [irradianceByRegion, setIrradianceByRegion] = useState<
    Record<string, number | null>
  >({})
  const [irradianceOpen, setIrradianceOpen] = useState(false)
  const [isLoading, startLoading] = useTransition()
  const [activeCell, setActiveCell] = useState<{
    row: number
    col: number
  } | null>(null)
  const [recDefaultPrice, setRecDefaultPrice] = useState("")
  const [isApplyingRecPrice, startApplyRecPrice] = useTransition()
  const [isExporting, startExport] = useTransition()
  const [isConfirming, startConfirming] = useTransition()

  const isConfirmed = status === "CONFIRMED"

  useEffect(() => {
    if (!clientGroupId) return
    startLoading(async () => {
      const [collectionPlants, result, irradiance, defaultPrice, collectionStatus] =
        await Promise.all([
          getCollectionPlantsAction(clientGroupId, query),
          getSmpReportRowsAction(month),
          getSolarIrradianceMonthlyAction(month),
          getRecDefaultPriceAction(month),
          getSmpCollectionStatusAction(clientGroupId, month),
        ])
      setPlants(collectionPlants)
      setRows(new Map(result.map((r) => [r.plantId, r])))
      setIrradianceByRegion(irradiance)
      setRecDefaultPrice(defaultPrice !== null ? String(defaultPrice) : "")
      setStatus(collectionStatus)
      setActiveCell(null)
    })
  }, [month, clientGroupId, query])

  function emptyReportRow(plantId: number): ReportRow {
    return {
      plantId,
      generationKwh: null,
      smpUnitPrice: null,
      supplyAmount: null,
      recQuantity: null,
      recUnitPrice: null,
      recAmount: null,
      recStatus: null,
    }
  }

  function patchRow(plantId: number, patch: Partial<ReportRow>) {
    setRows((prev) => {
      const next = new Map(prev)
      const current = next.get(plantId) ?? emptyReportRow(plantId)
      next.set(plantId, { ...current, ...patch })
      return next
    })
  }

  // "REC단가 일괄적용" 입력창. 입력된 단가를 대표 단가로 저장하고 화면에
  // 표시된 발전소 전체의 REC단가에 적용한다(수량은 각 행에 이미 표시된
  // 값 — 확정 수량 또는 발전량 기반 예상치 — 을 그대로 유지한다).
  function applyRecDefaultPrice() {
    const trimmed = recDefaultPrice.trim()
    if (trimmed === "") return
    const unitPrice = Number(trimmed)
    if (Number.isNaN(unitPrice)) {
      toast.error("숫자를 입력해 주세요.")
      return
    }
    const targets = plants.map((plant) => ({
      plantId: plant.id,
      quantity: getDisplayRecQuantity(plant, rows.get(plant.id)) ?? 0,
    }))
    startApplyRecPrice(async () => {
      const result = await applyRecUnitPriceToAllAction(
        month,
        unitPrice,
        targets,
      )
      if (result.error) {
        toast.error(result.error)
        return
      }
      setRows((prev) => {
        const next = new Map(prev)
        for (const { plantId, quantity } of targets) {
          const current = next.get(plantId) ?? emptyReportRow(plantId)
          next.set(plantId, {
            ...current,
            recQuantity: quantity,
            recUnitPrice: unitPrice,
            recAmount: quantity * unitPrice,
          })
        }
        return next
      })
      toast.success("전체 발전소에 REC단가를 적용했습니다.")
    })
  }

  // 현재 화면에 표시된 데이터를 한전 월 데이터 양식지 그대로 엑셀로 내보낸다.
  function handleExcelDownload() {
    startExport(async () => {
      const exportRows = plants.map((plant) =>
        toExportRow(plant, rows.get(plant.id), month, irradianceByRegion),
      )
      const result = await exportSmpReportAction(exportRows)
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      const blob = base64ToBlob(
        result.base64,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      )
      downloadBlob(blob, `${month}_월데이터.xlsx`)
    })
  }

  function handleConfirm() {
    if (!clientGroupId) return
    startConfirming(async () => {
      const result = await confirmSmpCollectionAction(clientGroupId, month)
      if (result.error) {
        toast.error(result.error)
        return
      }
      setStatus("CONFIRMED")
      setActiveCell(null)
      toast.success(
        `${month} 데이터를 확정했습니다. "REC" 탭에 반영됩니다.`,
      )
    })
  }

  function handleUnconfirm() {
    if (!clientGroupId) return
    startConfirming(async () => {
      const result = await unconfirmSmpCollectionAction(clientGroupId, month)
      if (result.error) {
        toast.error(result.error)
        return
      }
      setStatus("DRAFT")
      toast.success("확정을 취소했습니다. 다시 수정할 수 있습니다.")
    })
  }

  function moveActiveCell(rowDelta: number, colDelta: number) {
    setActiveCell((prev) => {
      if (!prev) return prev
      return {
        row: Math.min(Math.max(prev.row + rowDelta, 0), plants.length - 1),
        col: Math.min(
          Math.max(prev.col + colDelta, 0),
          EDITABLE_COLUMNS.length - 1,
        ),
      }
    })
  }

  const totalCapacity = plants.reduce((sum, p) => sum + (p.capacityKw ?? 0), 0)
  const totals = plants.reduce(
    (acc, plant) => {
      const row = rows.get(plant.id)
      acc.generationKwh += row?.generationKwh ?? 0
      acc.supplyAmount += row?.supplyAmount ?? 0
      acc.recQuantity += getDisplayRecQuantity(plant, row) ?? 0
      acc.recAmount += getDisplayRecAmount(plant, row) ?? 0
      const irradiance = plant.irradianceRegion
        ? (irradianceByRegion[plant.irradianceRegion] ?? null)
        : null
      if (irradiance !== null) {
        acc.irradianceSum += irradiance
        acc.irradianceCount += 1
      }
      return acc
    },
    {
      generationKwh: 0,
      supplyAmount: 0,
      recQuantity: 0,
      recAmount: 0,
      irradianceSum: 0,
      irradianceCount: 0,
    },
  )
  const averageIrradiance =
    totals.irradianceCount > 0
      ? totals.irradianceSum / totals.irradianceCount
      : null

  function renderGridCell(
    column: EditableColumn,
    colIndex: number,
    rowIndex: number,
    plant: ReportPlant,
    row: ReportRow | undefined,
    align?: "right" | "center",
  ) {
    return (
      <GridCell
        isActive={
          activeCell?.row === rowIndex && activeCell?.col === colIndex
        }
        readOnly={isConfirmed}
        config={getCellConfig(column, plant, row, month, patchRow)}
        align={align}
        onActivate={() => setActiveCell({ row: rowIndex, col: colIndex })}
        onMove={moveActiveCell}
        onCancel={() => setActiveCell(null)}
      />
    )
  }

  if (!clientGroupId) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border text-sm text-muted-foreground">
        위에서 거래처를 선택하면 해당 거래처의 월별 데이터를 수집·수정할 수
        있습니다.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <MonthSelect value={month} onChange={setMonth} />
          <Badge variant={isConfirmed ? "secondary" : "outline"}>
            {isConfirmed ? "확정됨" : "작업중"}
          </Badge>
          {isConfirmed ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isConfirming}
              onClick={handleUnconfirm}
            >
              <Unlock /> {isConfirming ? "처리 중..." : "확정 취소"}
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              disabled={isConfirming || plants.length === 0}
              onClick={handleConfirm}
            >
              <Lock /> {isConfirming ? "처리 중..." : "확정"}
            </Button>
          )}
          <div className="flex items-center gap-1.5 rounded-lg border border-input px-2 py-1">
            <span className="text-xs whitespace-nowrap text-muted-foreground">
              REC단가 일괄적용
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={recDefaultPrice}
              disabled={isConfirmed}
              onChange={(e) => setRecDefaultPrice(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  applyRecDefaultPrice()
                }
              }}
              placeholder="원/REC"
              className="w-20 rounded border border-input bg-background px-1.5 py-0.5 text-sm text-right outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={isApplyingRecPrice || isConfirmed}
              onClick={applyRecDefaultPrice}
            >
              {isApplyingRecPrice ? "적용 중..." : "전체 적용"}
            </Button>
          </div>
          {isLoading && (
            <span className="text-xs text-muted-foreground">
              데이터를 불러오는 중...
            </span>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="outline" size="icon" />}
          >
            <MoreHorizontal />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setIrradianceOpen(true)}>
              <Sun /> 수평면 일사량
            </DropdownMenuItem>
            <DropdownMenuItem disabled={isExporting} onClick={handleExcelDownload}>
              <FileSpreadsheet />{" "}
              {isExporting ? "엑셀 생성 중..." : "엑셀 다운로드"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="max-h-[70vh] overflow-auto rounded-lg border bg-card">
        <table className="w-full min-w-[1180px] border-separate border-spacing-0">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className={cn(thCell, "w-12")}>번호</th>
              <th className={cn(thCell, "w-48 text-left")}>발전소명</th>
              <th className={cn(thCell, "w-20")}>용량</th>
              <th className={cn(thCell, "w-24")}>발전량</th>
              <th className={cn(thCell, "w-20")}>발전시간</th>
              <th className={cn(thCell, "w-28")}>수평면 일사량</th>
              <th className={cn(thCell, "w-20")}>SMP단가</th>
              <th className={cn(thCell, "w-24")}>SMP매출</th>
              <th className={cn(thCell, "w-20")}>REC수량</th>
              <th className={cn(thCell, "w-20")}>REC단가</th>
              <th className={cn(thCell, "w-24")}>REC매출</th>
              <th className={cn(thCell, "w-28")}>매출총액(A)</th>
            </tr>
          </thead>
          <tbody>
            {plants.length === 0 && (
              <tr>
                <td
                  colSpan={12}
                  className="h-24 whitespace-normal text-center text-sm text-muted-foreground"
                >
                  이 거래처에 등록된 발전소가 없습니다.
                </td>
              </tr>
            )}
            {plants.map((plant, index) => {
              const row = rows.get(plant.id)
              const generationKwh = row?.generationKwh ?? null
              const generationHours = getGenerationHours(
                plant,
                generationKwh,
                month,
              )
              const recAmount = getDisplayRecAmount(plant, row)
              const totalAmount = (row?.supplyAmount ?? 0) + (recAmount ?? 0)
              const irradiance = plant.irradianceRegion
                ? (irradianceByRegion[plant.irradianceRegion] ?? null)
                : null
              const isKpxContract =
                getSmpContractType(plant.contractNumber) === "KPX"
              const computedSmpUnitPrice = isKpxContract
                ? getEffectiveSmpUnitPrice(plant, row, generationKwh)
                : null

              return (
                <tr key={plant.id}>
                  <td className={tdCell}>{index + 1}</td>
                  <td className={cn(tdCell, "text-left font-medium")}>
                    {plant.plantAlias ?? plant.plantName}
                  </td>
                  <td className={tdCell}>
                    {formatNumber(plant.capacityKw, 2)}
                  </td>
                  <td className={tdCell}>
                    {renderGridCell("generationKwh", 0, index, plant, row)}
                  </td>
                  <td className={tdCell}>
                    {generationHours !== null
                      ? formatNumber(generationHours, 1)
                      : "-"}
                  </td>
                  <td className={tdCell}>
                    {irradiance !== null ? formatNumber(irradiance, 0) : "-"}
                  </td>
                  <td className={tdCell}>
                    {isKpxContract
                      ? computedSmpUnitPrice !== null
                        ? formatNumber(computedSmpUnitPrice, 2)
                        : "-"
                      : renderGridCell(
                          "smpUnitPrice",
                          1,
                          index,
                          plant,
                          row,
                          "center",
                        )}
                  </td>
                  <td className={tdCell}>
                    {renderGridCell("supplyAmount", 2, index, plant, row)}
                  </td>
                  <td className={tdCell}>
                    {renderGridCell("recQuantity", 3, index, plant, row)}
                  </td>
                  <td className={tdCell}>
                    {renderGridCell("recUnitPrice", 4, index, plant, row)}
                  </td>
                  <td className={tdCell}>{formatAmount(recAmount)}</td>
                  <td className={cn(tdCell, "font-medium")}>
                    {row ? formatAmount(totalAmount) : "-"}
                  </td>
                </tr>
              )
            })}
          </tbody>
          {plants.length > 0 && (
            <tfoot className="sticky bottom-0 z-10">
              <tr>
                <td
                  className={cn(tdCell, "bg-muted/60 font-semibold")}
                  colSpan={2}
                >
                  합 계
                </td>
                <td className={cn(tdCell, "bg-muted/60 font-semibold")}>
                  {formatNumber(totalCapacity, 2)}
                </td>
                <td className={cn(tdCell, "bg-muted/60 font-semibold")}>
                  {formatAmount(totals.generationKwh)}
                </td>
                <td className={cn(tdCell, "bg-muted/60 font-semibold")}>
                  {totalCapacity
                    ? formatNumber(
                        totals.generationKwh / totalCapacity / daysInMonth(month),
                        1,
                      )
                    : "-"}
                </td>
                <td className={cn(tdCell, "bg-muted/60 font-semibold")}>
                  {averageIrradiance !== null
                    ? formatNumber(averageIrradiance, 0)
                    : "-"}
                </td>
                <td className={cn(tdCell, "bg-muted/60 font-semibold")}>
                  {totals.generationKwh
                    ? formatNumber(
                        totals.supplyAmount / totals.generationKwh,
                        2,
                      )
                    : "-"}
                </td>
                <td className={cn(tdCell, "bg-muted/60 font-semibold")}>
                  {formatAmount(totals.supplyAmount)}
                </td>
                <td className={cn(tdCell, "bg-muted/60 font-semibold")}>
                  {formatAmount(totals.recQuantity)}
                </td>
                <td className={cn(tdCell, "bg-muted/60 font-semibold")}>-</td>
                <td className={cn(tdCell, "bg-muted/60 font-semibold")}>
                  {formatAmount(totals.recAmount)}
                </td>
                <td className={cn(tdCell, "bg-muted/60 font-semibold")}>
                  {formatAmount(totals.supplyAmount + totals.recAmount)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <IrradianceDialog
        open={irradianceOpen}
        onOpenChange={setIrradianceOpen}
        month={month}
        onSaved={setIrradianceByRegion}
      />
    </div>
  )
}
