"use client"

import { useState, useTransition } from "react"
import { Download, FileSpreadsheet, MoreHorizontal, RotateCcw } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { generateInvoiceAction } from "./actions"
import { base64ToBlob, downloadBlob } from "./grid-shared"
import { DownloadDialog } from "./download-dialog"
import { ResetDataDialog } from "./reset-data-dialog"

export function ActionsMenu({
  disabled,
  clientGroupId,
  targetMonth,
  onReset,
}: {
  disabled?: boolean
  clientGroupId?: number
  targetMonth: string
  onReset?: () => void
}) {
  const [downloadOpen, setDownloadOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [isGenerating, startGenerating] = useTransition()

  function handleGenerateInvoice() {
    if (!clientGroupId) {
      toast.error("거래처를 먼저 선택해 주세요.")
      return
    }
    startGenerating(async () => {
      const result = await generateInvoiceAction(clientGroupId, targetMonth)
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      if (result.unmatchedPlantNames.length > 0) {
        toast.warning(
          `양식에서 매칭되는 행을 찾지 못한 발전소: ${result.unmatchedPlantNames.join(", ")}`,
        )
      }
      const blob = base64ToBlob(result.base64, "application/vnd.ms-excel")
      downloadBlob(blob, result.fileName)
      toast.success("세금계산서 파일을 생성했습니다.")
    })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="outline" size="icon" disabled={disabled} />}
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => setDownloadOpen(true)}>
            <Download /> 다운로드
          </DropdownMenuItem>
          <DropdownMenuItem disabled={isGenerating} onClick={handleGenerateInvoice}>
            <FileSpreadsheet /> {isGenerating ? "세금계산서 생성 중..." : "세금계산서"}
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setResetOpen(true)}
          >
            <RotateCcw /> 초기화
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DownloadDialog
        open={downloadOpen}
        onOpenChange={setDownloadOpen}
        targetMonth={targetMonth}
      />
      <ResetDataDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        onReset={onReset}
      />
    </>
  )
}
