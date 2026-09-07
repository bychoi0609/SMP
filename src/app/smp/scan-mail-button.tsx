"use client"

import { useTransition } from "react"
import { RefreshCw } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { scanMailAction } from "./actions"

export function ScanMailButton({
  targetMonth,
  clientGroupId,
  onScanComplete,
}: {
  targetMonth: string
  clientGroupId?: number
  onScanComplete?: () => void
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <Button
      variant="outline"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          const state = await scanMailAction(targetMonth, clientGroupId)
          if (state.error) {
            toast.error(state.error)
            return
          }
          const r = state.result
          if (!r) return
          const otherClientNote =
            clientGroupId && r.skippedOtherClient > 0
              ? ` · 다른 거래처 제외 ${r.skippedOtherClient}건`
              : ""
          toast.success(
            `메일함 ${r.scannedFolders}개 확인 · 대상 메일 ${r.matchedMails}건 · 신규 ${r.created}건(검토필요 ${r.needsReview}건) · 중복 제외 ${r.skippedDuplicate}건${otherClientNote}`,
          )
          if (r.erroredFolders.length > 0) {
            toast.error(
              `일부 메일함을 확인하지 못했습니다: ${r.erroredFolders.join(", ")}`,
            )
          }
          onScanComplete?.()
        })
      }}
    >
      <RefreshCw className={isPending ? "animate-spin" : undefined} />
      {isPending ? "메일 확인 중..." : "선택 월 메일 확인"}
    </Button>
  )
}
