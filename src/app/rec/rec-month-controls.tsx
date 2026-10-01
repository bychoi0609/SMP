"use client"

import { useState, useTransition } from "react"
import { CheckCheck, ChevronDown, Undo2 } from "lucide-react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  applyRecDefaultPriceAction,
  resetRecPriceAction,
  resetRecQuantityAction,
  setRecConfirmedAction,
  type RecRowPatch,
} from "./actions"

export type RecMonthSummary = {
  total: number // 화면에 보이는 발전소
  settled: number // REC 확정
  missingPrice: number // 수량은 있는데 단가가 없음(확정 시 건너뜀)
  actual: number // 실제 발급량 입력
}

// REC 탭 표 위 작업 줄: 대표단가 적용, 진행 요약, 전체 확정/확정 취소.
// 대상은 지금 거래처·검색 필터로 보이는 발전소(plantIds)다.
export function RecMonthToolbar({
  month,
  plantIds,
  initialDefaultPrice,
  summary,
  onPatches,
}: {
  month: string
  plantIds: number[]
  initialDefaultPrice: number | null
  summary: RecMonthSummary
  onPatches: (patches: RecRowPatch[]) => void
}) {
  const [defaultPrice, setDefaultPrice] = useState(
    initialDefaultPrice !== null ? String(initialDefaultPrice) : "",
  )
  const [confirmDialog, setConfirmDialog] = useState<"confirm" | "unconfirm" | null>(null)
  const [isApplying, startApply] = useTransition()
  const [isConfirming, startConfirm] = useTransition()

  function applyDefaultPrice() {
    const trimmed = defaultPrice.trim()
    if (trimmed === "") return
    const unitPrice = Number(trimmed)
    if (Number.isNaN(unitPrice)) {
      toast.error("숫자를 입력해 주세요.")
      return
    }
    startApply(async () => {
      const result = await applyRecDefaultPriceAction(month, unitPrice, plantIds)
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      onPatches(result.patches)
      const parts = [`대표단가 ${result.appliedCount}곳`]
      if (result.carriedCount > 0) parts.push(`지난달 개별 단가 ${result.carriedCount}곳`)
      if (result.keptCount > 0) parts.push(`개별 단가 유지 ${result.keptCount}곳`)
      toast.success(`REC단가를 적용했어요. (${parts.join(" · ")})`)
    })
  }

  function runBulk(confirmed: boolean) {
    startConfirm(async () => {
      const result = await setRecConfirmedAction(month, plantIds, confirmed)
      setConfirmDialog(null)
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      onPatches(result.patches)
      if (!confirmed) {
        toast.success("확정을 취소했어요. 수량·단가는 그대로 남아 있어요.")
      } else if (result.skippedCount > 0) {
        toast.warning(
          `${result.patches.length}곳을 확정했어요. 단가가 없는 ${result.skippedCount}곳은 건너뛰었어요.`,
        )
      } else {
        toast.success(`${result.patches.length}곳을 모두 확정했어요.`)
      }
    })
  }

  const allSettled = summary.total > 0 && summary.settled >= summary.total

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-lg border border-input px-2 py-1">
          <span className="text-xs whitespace-nowrap text-muted-foreground">
            {month} 대표단가
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={defaultPrice}
            onChange={(e) => setDefaultPrice(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                applyDefaultPrice()
              }
            }}
            placeholder="원/REC"
            className="w-24 rounded border border-input bg-background px-1.5 py-0.5 text-right text-sm tabular-nums outline-none focus:ring-1 focus:ring-ring"
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={isApplying || plantIds.length === 0}
            onClick={applyDefaultPrice}
          >
            {isApplying ? "적용 중..." : "적용"}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          확정{" "}
          <span className="font-medium text-foreground tabular-nums">
            {summary.settled}/{summary.total}
          </span>
          곳 · 단가 미입력{" "}
          <span className="font-medium text-foreground tabular-nums">
            {summary.missingPrice}
          </span>
          곳 · 실제 발급량{" "}
          <span className="font-medium text-foreground tabular-nums">
            {summary.actual}
          </span>
          곳
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isConfirming || summary.settled === 0}
          onClick={() => setConfirmDialog("unconfirm")}
        >
          <Undo2 /> 확정 취소
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={isConfirming || allSettled || summary.total === 0}
          onClick={() => setConfirmDialog("confirm")}
        >
          <CheckCheck /> 전체 확정
        </Button>
      </div>

      <AlertDialog
        open={confirmDialog !== null}
        onOpenChange={(open) => !open && setConfirmDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog === "confirm"
                ? `${month} REC를 확정할까요?`
                : `${month} REC 확정을 취소할까요?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog === "confirm"
                ? `보이는 발전소 ${summary.total}곳의 지금 수량·단가로 확정합니다.` +
                  (summary.missingPrice > 0
                    ? ` 단가가 없는 ${summary.missingPrice}곳은 건너뜁니다.`
                    : "")
                : `확정된 ${summary.settled}곳을 잠정으로 되돌립니다. 입력한 수량·단가는 그대로 남아요.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>닫기</AlertDialogCancel>
            <AlertDialogAction
              disabled={isConfirming}
              onClick={() => runBulk(confirmDialog === "confirm")}
            >
              {isConfirming
                ? "처리 중..."
                : confirmDialog === "confirm"
                  ? "확정"
                  : "확정 취소"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// 행 맨 오른쪽 상태 뱃지. 누르면 그 행만 확정/취소하거나 예상치·대표단가로 되돌린다.
export function RecRowStatusMenu({
  month,
  plantId,
  settled,
  hasRow,
  quantityIsActual,
  unitPriceIsManual,
  onPatches,
}: {
  month: string
  plantId: number
  settled: boolean
  hasRow: boolean
  quantityIsActual: boolean
  unitPriceIsManual: boolean
  onPatches: (patches: RecRowPatch[]) => void
}) {
  const [isPending, startTransition] = useTransition()

  function setConfirmed(confirmed: boolean) {
    startTransition(async () => {
      const result = await setRecConfirmedAction(month, [plantId], confirmed)
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      if (confirmed && result.skippedCount > 0) {
        toast.error("REC단가를 먼저 입력해 주세요.")
        return
      }
      onPatches(result.patches)
    })
  }

  function reset(kind: "quantity" | "price") {
    startTransition(async () => {
      const result =
        kind === "quantity"
          ? await resetRecQuantityAction(plantId, month)
          : await resetRecPriceAction(plantId, month)
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      onPatches([result.patch])
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={isPending}
        render={
          <button
            type="button"
            className="inline-flex items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        }
      >
        <Badge variant={settled ? "secondary" : "outline"}>
          {isPending ? "처리 중" : settled ? "확정" : "SMP확정"}
          <ChevronDown className="size-3" />
        </Badge>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {settled ? (
          <DropdownMenuItem onClick={() => setConfirmed(false)}>
            확정 취소
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => setConfirmed(true)}>
            이 발전소 확정
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={!hasRow || !quantityIsActual}
          onClick={() => reset("quantity")}
        >
          수량을 예상치로 되돌리기
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!hasRow || !unitPriceIsManual}
          onClick={() => reset("price")}
        >
          단가를 대표단가로 되돌리기
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
