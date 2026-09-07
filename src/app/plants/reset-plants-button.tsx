"use client"

import { useState, useTransition } from "react"
import { RotateCcw } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { resetPlantsDataAction } from "./actions"

export function ResetPlantsButton({
  disabled,
  clientGroupId,
  clientGroupName,
}: {
  disabled?: boolean
  clientGroupId?: number
  clientGroupName?: string
}) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const scopeLabel = clientGroupId ? `${clientGroupName} 거래처` : "전체"

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={<Button variant="outline" disabled={disabled} />}
      >
        <RotateCcw /> 초기화
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {scopeLabel} 발전소 마스터 데이터를 초기화할까요?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {clientGroupId ? `${clientGroupName} 거래처의` : "모든"} 발전소와
            연결된 REC 데이터가 삭제됩니다. 연결된 SMP 데이터도 함께
            삭제되지만, 이미 &quot;발행완료&quot; 처리된 발전소는 세금계산서
            이력 보호를 위해 삭제되지 않습니다. 이 작업은 되돌릴 수 없습니다.
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
                  const { deleted } = await resetPlantsDataAction(clientGroupId)
                  toast.success(`발전소 ${deleted}건을 초기화했습니다.`)
                  setOpen(false)
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
