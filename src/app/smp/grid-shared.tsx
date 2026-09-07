"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { toast } from "sonner"

import { formatAmount, formatNumber } from "@/lib/format"
import { daysInMonth } from "@/lib/date"
import { getSmpContractType } from "@/lib/smp-contract-type"
import { estimateRecQuantity } from "@/lib/rec-quantity"
import { cn } from "@/lib/utils"
import { upsertRecRowAction } from "@/app/rec/actions"
import type { SmpReportExportRow } from "@/lib/smp-report-export"
import {
  updateSmpReportCellAction,
  type ReportPlant,
  type ReportRow,
} from "./actions"

export const thCell =
  "border border-border bg-muted px-3 py-2.5 text-center text-sm font-medium whitespace-nowrap"
export const tdCell =
  "border border-border px-3 py-2 text-center text-sm tabular-nums"

export const EDITABLE_COLUMNS = [
  "generationKwh",
  "smpUnitPrice",
  "supplyAmount",
  "recQuantity",
  "recUnitPrice",
] as const
export type EditableColumn = (typeof EDITABLE_COLUMNS)[number]

export type CellConfig = {
  value: number | null
  step: string
  format: (value: number | null) => string
  onSave: (value: number) => Promise<{ error?: string }>
}

// REC수량이 아직 확정되지 않았을 때(발전량만 존재) 보여줄 예상치를 구한다.
// 사용자가 REC수량을 직접 입력해 CONFIRMED(확정) 상태가 된 값만 그대로
// 우선한다. TENTATIVE(잠정) 상태는 "REC단가 일괄적용" 등으로 자동 채워진
// 값일 뿐이므로, 배율/발전량이 바뀌면 계속 최신 예상치로 다시 계산한다.
export function getDisplayRecQuantity(
  plant: ReportPlant,
  row: ReportRow | undefined,
): number | null {
  if (
    row?.recStatus === "CONFIRMED" &&
    row.recQuantity !== null &&
    row.recQuantity !== undefined
  ) {
    return row.recQuantity
  }
  if (row?.generationKwh === null || row?.generationKwh === undefined) {
    return null
  }
  return estimateRecQuantity(
    row.generationKwh,
    plant.plantAlias ?? plant.plantName,
  )
}

// REC매출 = 같은 행의 REC수량(확정 또는 예상치) × REC단가. 단가가 아직
// 입력되지 않았으면 매출도 미확정 상태이므로 표시하지 않는다.
export function getDisplayRecAmount(
  plant: ReportPlant,
  row: ReportRow | undefined,
): number | null {
  const quantity = getDisplayRecQuantity(plant, row)
  if (
    quantity === null ||
    row?.recUnitPrice === null ||
    row?.recUnitPrice === undefined
  ) {
    return null
  }
  return quantity * row.recUnitPrice
}

// 발전량과 용량으로부터 해당 월의 일평균 발전시간을 구한다.
export function getGenerationHours(
  plant: ReportPlant,
  generationKwh: number | null,
  month: string,
): number | null {
  if (generationKwh === null || !plant.capacityKw) return null
  return generationKwh / plant.capacityKw / daysInMonth(month)
}

// 한국전력거래소(KPX)와 SMP계약된 발전소는 SMP단가를 직접 입력하지 않고
// 같은 행의 발전량·SMP매출로부터 역산한다.
export function getEffectiveSmpUnitPrice(
  plant: ReportPlant,
  row: ReportRow | undefined,
  generationKwh: number | null,
): number | null {
  const isKpxContract = getSmpContractType(plant.contractNumber) === "KPX"
  if (isKpxContract) {
    return generationKwh ? (row?.supplyAmount ?? 0) / generationKwh : null
  }
  return row?.smpUnitPrice ?? null
}

export function toExportRow(
  plant: ReportPlant,
  row: ReportRow | undefined,
  month: string,
  irradianceByRegion: Record<string, number | null>,
): SmpReportExportRow {
  const generationKwh = row?.generationKwh ?? null
  const recAmount = getDisplayRecAmount(plant, row)
  return {
    plantName: plant.plantAlias ?? plant.plantName,
    capacityKw: plant.capacityKw,
    generationKwh,
    generationHours: getGenerationHours(plant, generationKwh, month),
    irradiance: plant.irradianceRegion
      ? (irradianceByRegion[plant.irradianceRegion] ?? null)
      : null,
    smpUnitPrice: getEffectiveSmpUnitPrice(plant, row, generationKwh),
    supplyAmount: row?.supplyAmount ?? null,
    recQuantity: getDisplayRecQuantity(plant, row),
    recUnitPrice: row?.recUnitPrice ?? null,
    recAmount,
    totalAmount: row ? (row.supplyAmount ?? 0) + (recAmount ?? 0) : null,
  }
}

export function base64ToBlob(base64: string, mime: string): Blob {
  const byteChars = atob(base64)
  const bytes = new Uint8Array(byteChars.length)
  for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function getCellConfig(
  column: EditableColumn,
  plant: ReportPlant,
  row: ReportRow | undefined,
  month: string,
  patchRow: (plantId: number, patch: Partial<ReportRow>) => void,
): CellConfig {
  switch (column) {
    case "generationKwh":
      return {
        value: row?.generationKwh ?? null,
        step: "1",
        format: formatAmount,
        onSave: async (value) => {
          const result = await updateSmpReportCellAction(
            plant.id,
            month,
            "generationKwh",
            value,
          )
          if (!result.error) patchRow(plant.id, { generationKwh: value })
          return result
        },
      }
    case "smpUnitPrice":
      return {
        value: row?.smpUnitPrice ?? null,
        step: "0.01",
        format: (v) => (v ? formatNumber(v, 2) : "-"),
        onSave: async (value) => {
          const result = await updateSmpReportCellAction(
            plant.id,
            month,
            "smpUnitPrice",
            value,
          )
          if (!result.error) patchRow(plant.id, { smpUnitPrice: value })
          return result
        },
      }
    case "supplyAmount":
      return {
        value: row?.supplyAmount ?? null,
        step: "1",
        format: formatAmount,
        onSave: async (value) => {
          const result = await updateSmpReportCellAction(
            plant.id,
            month,
            "supplyAmount",
            value,
          )
          if (!result.error) patchRow(plant.id, { supplyAmount: value })
          return result
        },
      }
    case "recQuantity":
      return {
        value: getDisplayRecQuantity(plant, row),
        step: "1",
        format: formatAmount,
        onSave: async (value) => {
          const unitPrice = row?.recUnitPrice ?? 0
          const result = await upsertRecRowAction(
            plant.id,
            month,
            value,
            unitPrice,
            { confirmQuantity: true },
          )
          if (!result.error) {
            patchRow(plant.id, {
              recQuantity: value,
              recAmount: value * unitPrice,
              recStatus: "CONFIRMED",
            })
          }
          return result
        },
      }
    case "recUnitPrice":
      return {
        value: row?.recUnitPrice ?? null,
        step: "0.01",
        format: formatAmount,
        onSave: async (value) => {
          const quantity = getDisplayRecQuantity(plant, row) ?? 0
          const result = await upsertRecRowAction(
            plant.id,
            month,
            quantity,
            value,
          )
          if (!result.error) {
            patchRow(plant.id, {
              recQuantity: quantity,
              recUnitPrice: value,
              recAmount: quantity * value,
            })
          }
          return result
        },
      }
  }
}

// 표에서 좌우 이동 시 건너뛰는 순서(시각적 좌→우 순서와 동일). 나머지 열은
// 수정할 수 없으므로 이동 대상에서 제외한다.
// 그리드 표의 수정 가능한 데이터셀. 엑셀처럼 클릭/Enter로 입력창이 되고,
// 방향키로 다른 셀로 이동한다(커서가 값의 양 끝에 있을 때만 좌우 이동).
// readOnly가 true면 값만 보여주고 편집을 막는다.
export function GridCell({
  isActive,
  readOnly,
  config,
  align = "right",
  onActivate,
  onMove,
  onCancel,
}: {
  isActive: boolean
  readOnly: boolean
  config: CellConfig
  align?: "right" | "center"
  onActivate: () => void
  onMove: (rowDelta: number, colDelta: number) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState(() =>
    config.value !== null ? String(config.value) : "",
  )
  const [wasActive, setWasActive] = useState(isActive)
  const [isPending, startTransition] = useTransition()
  const committedRef = useRef(false)

  // 셀이 새로 활성화될 때만 입력값을 최신 값으로 되돌린다(렌더 중 상태 조정
  // 패턴 — effect를 쓰면 불필요한 추가 렌더가 발생함).
  if (isActive !== wasActive) {
    setWasActive(isActive)
    if (isActive) {
      setDraft(config.value !== null ? String(config.value) : "")
    }
  }

  useEffect(() => {
    if (isActive) committedRef.current = false
  }, [isActive])

  if (readOnly || !isActive) {
    return (
      <button
        type="button"
        disabled={readOnly}
        onClick={onActivate}
        className={cn(
          "block w-full rounded px-1",
          align === "center" ? "text-center" : "text-right",
          !readOnly && "hover:bg-accent/60",
        )}
      >
        {config.format(config.value)}
      </button>
    )
  }

  function commit() {
    if (committedRef.current) return
    committedRef.current = true
    const trimmed = draft.trim()
    if (trimmed === "") return
    const num = Number(trimmed)
    if (Number.isNaN(num) || num === config.value) return
    startTransition(async () => {
      const result = await config.onSave(num)
      if (result.error) toast.error(result.error)
    })
  }

  return (
    <input
      autoFocus
      type="text"
      inputMode="decimal"
      value={draft}
      disabled={isPending}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        const el = e.currentTarget
        switch (e.key) {
          case "Enter":
            e.preventDefault()
            commit()
            onMove(1, 0)
            break
          case "ArrowUp":
            e.preventDefault()
            commit()
            onMove(-1, 0)
            break
          case "ArrowDown":
            e.preventDefault()
            commit()
            onMove(1, 0)
            break
          case "ArrowLeft":
            if (el.selectionStart === 0 && el.selectionEnd === 0) {
              e.preventDefault()
              commit()
              onMove(0, -1)
            }
            break
          case "ArrowRight":
            if (
              el.selectionStart === draft.length &&
              el.selectionEnd === draft.length
            ) {
              e.preventDefault()
              commit()
              onMove(0, 1)
            }
            break
          case "Escape":
            e.preventDefault()
            committedRef.current = true
            onCancel()
            break
        }
      }}
      className={cn(
        "w-full rounded border border-input bg-background px-1 outline-none focus:ring-1 focus:ring-ring",
        align === "center" ? "text-center" : "text-right",
      )}
    />
  )
}
