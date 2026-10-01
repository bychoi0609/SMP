"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { toast } from "sonner"

import { formatAmount, formatNumber } from "@/lib/format"
import {
  getDisplayRecAmount,
  getDisplayRecQuantity,
  getEffectiveSmpUnitPrice,
  getGenerationHours,
  getRowCapacity,
  isRecQuantityFixed,
} from "@/lib/revenue-calc"
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
  // 값 옆에 붙는 작은 표시(예: "예상", "개별")와, 값을 흐리게 보여줄지 여부
  tag?: string
  muted?: boolean
}

export {
  emptyReportRow,
  getDisplayRecAmount,
  getDisplayRecQuantity,
  getEffectiveSmpUnitPrice,
  getGenerationHours,
  getRowCapacity,
  isRecQuantityFixed,
} from "@/lib/revenue-calc"

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
    capacityKw: getRowCapacity(plant, row),
    generationKwh,
    generationHours: getGenerationHours(getRowCapacity(plant, row), generationKwh, month),
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
  // REC 탭(월말 작업)에서는 단가를 입력하면 표시된 수량(예상치 또는 실제 발급량)과
  // 함께 그 행을 확정한다. 엑셀에서도 실제 발급량이 예상치와 같으면 수량을 따로
  // 고치지 않기 때문. SMP 탭에서는 발전량이 아직 바뀔 수 있어 확정하지 않는다.
  // showRecTags: REC 수량·단가 옆에 "예상"/"개별" 표시를 붙인다(REC 탭).
  options?: { confirmRecOnPriceSave?: boolean; showRecTags?: boolean },
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
        ...(options?.showRecTags &&
        !isRecQuantityFixed(row) &&
        getDisplayRecQuantity(plant, row) !== null
          ? { tag: "예상", muted: true }
          : {}),
        onSave: async (value) => {
          const unitPrice = row?.recUnitPrice ?? 0
          const result = await upsertRecRowAction(
            plant.id,
            month,
            value,
            unitPrice,
            { markQuantityActual: true },
          )
          if (!result.error) {
            patchRow(plant.id, {
              recQuantity: value,
              recAmount: value * unitPrice,
              recQuantityIsActual: true,
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
        ...(options?.showRecTags && row?.recUnitPriceIsManual ? { tag: "개별" } : {}),
        onSave: async (value) => {
          const quantity = getDisplayRecQuantity(plant, row) ?? 0
          const confirm = options?.confirmRecOnPriceSave ?? false
          const result = await upsertRecRowAction(
            plant.id,
            month,
            quantity,
            value,
            { markPriceManual: true, confirm },
          )
          if (!result.error) {
            patchRow(plant.id, {
              recQuantity: quantity,
              recUnitPrice: value,
              recAmount: quantity * value,
              recUnitPriceIsManual: true,
              ...(confirm ? { recStatus: "CONFIRMED" as const } : {}),
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
          config.muted && "text-muted-foreground",
        )}
      >
        {config.tag && (
          <span className="mr-1 rounded bg-muted px-1 text-[10px] font-normal text-muted-foreground">
            {config.tag}
          </span>
        )}
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
