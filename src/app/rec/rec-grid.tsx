"use client"

import { useState, useTransition } from "react"
import { FileSpreadsheet } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { formatAmount, formatNumber } from "@/lib/format"
import { daysInMonth } from "@/lib/date"
import { cn } from "@/lib/utils"
import {
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
} from "../smp/grid-shared"
import {
  exportSmpReportAction,
  type ReportPlant,
  type ReportRow,
} from "../smp/actions"

// REC 탭에서는 확정된 SMP 데이터(발전량/SMP단가/SMP매출)는 읽기 전용으로만
// 보여주고, REC수량·REC단가만 발전소별로 개별 수정할 수 있다.
const EDITABLE_COLUMNS = ["recQuantity", "recUnitPrice"] as const
type EditableColumn = (typeof EDITABLE_COLUMNS)[number]

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

export function RecGrid({
  month,
  plants,
  initialRows,
  irradianceByRegion,
}: {
  month: string
  plants: ReportPlant[]
  initialRows: ReportRow[]
  irradianceByRegion: Record<string, number | null>
}) {
  const [rows, setRows] = useState<Map<number, ReportRow>>(
    () => new Map(initialRows.map((r) => [r.plantId, r])),
  )
  const [activeCell, setActiveCell] = useState<{
    row: number
    col: number
  } | null>(null)
  const [isExporting, startExport] = useTransition()

  function patchRow(plantId: number, patch: Partial<ReportRow>) {
    setRows((prev) => {
      const next = new Map(prev)
      const current = next.get(plantId) ?? emptyReportRow(plantId)
      next.set(plantId, { ...current, ...patch })
      return next
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

  // REC 탭에 지금 표시된 데이터를 그대로(수정 중인 값 포함) 한전 월 데이터
  // 양식지와 동일한 엑셀로 즉시 내보낸다.
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
      downloadBlob(blob, `${month}_REC데이터.xlsx`)
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
  ) {
    return (
      <GridCell
        isActive={
          activeCell?.row === rowIndex && activeCell?.col === colIndex
        }
        readOnly={false}
        config={getCellConfig(column, plant, row, month, patchRow)}
        onActivate={() => setActiveCell({ row: rowIndex, col: colIndex })}
        onMove={moveActiveCell}
        onCancel={() => setActiveCell(null)}
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isExporting}
          onClick={handleExcelDownload}
        >
          <FileSpreadsheet />{" "}
          {isExporting ? "엑셀 생성 중..." : "엑셀 다운로드"}
        </Button>
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
                  확정된 데이터가 없습니다.
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
              const smpUnitPrice = getEffectiveSmpUnitPrice(
                plant,
                row,
                generationKwh,
              )

              return (
                <tr key={plant.id}>
                  <td className={tdCell}>{index + 1}</td>
                  <td className={cn(tdCell, "text-left font-medium")}>
                    {plant.plantAlias ?? plant.plantName}
                  </td>
                  <td className={tdCell}>
                    {formatNumber(plant.capacityKw, 2)}
                  </td>
                  <td className={tdCell}>{formatAmount(generationKwh)}</td>
                  <td className={tdCell}>
                    {generationHours !== null
                      ? formatNumber(generationHours, 1)
                      : "-"}
                  </td>
                  <td className={tdCell}>
                    {irradiance !== null ? formatNumber(irradiance, 0) : "-"}
                  </td>
                  <td className={tdCell}>
                    {smpUnitPrice !== null
                      ? formatNumber(smpUnitPrice, 2)
                      : "-"}
                  </td>
                  <td className={tdCell}>
                    {formatAmount(row?.supplyAmount ?? null)}
                  </td>
                  <td className={tdCell}>
                    {renderGridCell("recQuantity", 0, index, plant, row)}
                  </td>
                  <td className={tdCell}>
                    {renderGridCell("recUnitPrice", 1, index, plant, row)}
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
                  className={cn(tdCell, "bg-muted font-semibold")}
                  colSpan={2}
                >
                  합 계
                </td>
                <td className={cn(tdCell, "bg-muted font-semibold")}>
                  {formatNumber(totalCapacity, 2)}
                </td>
                <td className={cn(tdCell, "bg-muted font-semibold")}>
                  {formatAmount(totals.generationKwh)}
                </td>
                <td className={cn(tdCell, "bg-muted font-semibold")}>
                  {totalCapacity
                    ? formatNumber(
                        totals.generationKwh / totalCapacity / daysInMonth(month),
                        1,
                      )
                    : "-"}
                </td>
                <td className={cn(tdCell, "bg-muted font-semibold")}>
                  {averageIrradiance !== null
                    ? formatNumber(averageIrradiance, 0)
                    : "-"}
                </td>
                <td className={cn(tdCell, "bg-muted font-semibold")}>
                  {totals.generationKwh
                    ? formatNumber(
                        totals.supplyAmount / totals.generationKwh,
                        2,
                      )
                    : "-"}
                </td>
                <td className={cn(tdCell, "bg-muted font-semibold")}>
                  {formatAmount(totals.supplyAmount)}
                </td>
                <td className={cn(tdCell, "bg-muted font-semibold")}>
                  {formatAmount(totals.recQuantity)}
                </td>
                <td className={cn(tdCell, "bg-muted font-semibold")}>-</td>
                <td className={cn(tdCell, "bg-muted font-semibold")}>
                  {formatAmount(totals.recAmount)}
                </td>
                <td className={cn(tdCell, "bg-muted font-semibold")}>
                  {formatAmount(totals.supplyAmount + totals.recAmount)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
