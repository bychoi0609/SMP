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
  onReset,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onReset?: () => void
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>수집된 SMP 데이터를 전체 초기화할까요?</AlertDialogTitle>
          <AlertDialogDescription>
            모든 귀속월의 SMP 데이터가 삭제됩니다. 이미 &quot;발행완료&quot;
            처리된 데이터는 세금계산서 이력 보호를 위해 삭제되지 않습니다.
            이 작업은 되돌릴 수 없습니다.
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
                  const { deleted } = await resetSmpDataAction()
                  toast.success(`SMP 데이터 ${deleted}건을 초기화했습니다.`)
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
