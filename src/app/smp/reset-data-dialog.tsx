"use client"

import { useTransition } from "react"
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
import { resetSmpDataAction } from "./actions"

export function ResetDataDialog({
  open,
  onOpenChange,
  targetMonth,
  clientGroupId,
  clientGroupName,
  onReset,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  targetMonth: string // 초기화할 귀속월(YYYY-MM)
  clientGroupId?: number // 없으면 그 달 전체 거래처
  clientGroupName?: string
  onReset?: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [year, month] = targetMonth.split("-")
  const monthLabel = `${year}년 ${Number(month)}월`
  const scopeLabel = clientGroupId
    ? `${clientGroupName ?? "선택한 거래처"} ${monthLabel}분`
    : `전체 거래처 ${monthLabel}분`

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{scopeLabel} SMP 데이터를 초기화할까요?</AlertDialogTitle>
          <AlertDialogDescription>
            {clientGroupId
              ? `${clientGroupName ?? "선택한 거래처"} 발전소의 귀속월 ${monthLabel} SMP 데이터만 삭제되고, 다른 거래처와 다른 달은 그대로 남아요.`
              : `귀속월 ${monthLabel}의 모든 거래처 SMP 데이터가 삭제되고, 다른 달은 그대로 남아요.`}
            &quot;발행완료&quot; 처리된 데이터는 세금계산서 이력 보호를 위해 삭제되지
            않으니, 지우려면 먼저 발행완료 체크를 풀어 주세요. REC 데이터와 확정 상태는
            바뀌지 않아요. 이 작업은 되돌릴 수 없어요.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>취소</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isPending}
            onClick={() => {
              startTransition(async () => {
                try {
                  const { deleted, keptIssued } = await resetSmpDataAction(
                    targetMonth,
                    clientGroupId,
                  )
                  if (keptIssued > 0) {
                    toast.warning(
                      `${scopeLabel} ${deleted}건을 초기화했어요. 발행완료 ${keptIssued}건은 남겨 두었어요.`,
                    )
                  } else {
                    toast.success(`${scopeLabel} SMP 데이터 ${deleted}건을 초기화했어요.`)
                  }
                  onOpenChange(false)
                  onReset?.()
                } catch {
                  toast.error("초기화하지 못했습니다.")
                }
              })
            }}
          >
            {isPending ? "초기화 중..." : "초기화"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
