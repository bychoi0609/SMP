"use client"

import { useState, useTransition } from "react"
import { Trash2 } from "lucide-react"
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

export function DeletePlantButton({
  plantId,
  plantName,
  action,
}: {
  plantId: number
  plantName: string
  action: (id: number) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`${plantName} 삭제`}
          >
            <Trash2 className="text-destructive" />
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{plantName} 발전소를 삭제할까요?</AlertDialogTitle>
          <AlertDialogDescription>
            연결된 SMP·REC 월별 데이터가 있으면 삭제가 거부될 수 있습니다. 이
            작업은 되돌릴 수 없습니다.
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
                  await action(plantId)
                  setOpen(false)
                } catch {
                  toast.error(
                    "삭제하지 못했습니다. 연결된 SMP·REC 데이터가 있는지 확인해 주세요.",
                  )
                }
              })
            }}
          >
            {isPending ? "삭제 중..." : "삭제"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
