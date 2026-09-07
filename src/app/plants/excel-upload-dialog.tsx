"use client"

import { useRef, useState, useTransition } from "react"
import { ChevronDown, Download, FileSpreadsheet, Upload } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { bulkUploadPlantsAction } from "./actions"

export function ExcelUploadDialog() {
  const [uploadOpen, setUploadOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const [isPending, startTransition] = useTransition()

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" />}>
          <FileSpreadsheet /> 엑셀 <ChevronDown />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => setUploadOpen(true)}>
            <Upload /> 엑셀 업로드
          </DropdownMenuItem>
          <DropdownMenuItem render={<a href="/api/plants/export" />}>
            <Download /> 엑셀 다운로드
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>발전소 엑셀 일괄 업로드</DialogTitle>
            <DialogDescription>
              여러 발전소를 한 번에 등록·수정할 수 있습니다. 거래처명은
              미리 등록된 거래처명과 정확히 같아야 합니다. 이미 등록된
              계약번호는 내용이 갱신됩니다.
            </DialogDescription>
          </DialogHeader>

          <a
            href="/api/plants/sample"
            className="flex w-fit items-center gap-1.5 text-sm text-primary underline underline-offset-4"
          >
            <Download className="size-4" /> 샘플 파일 다운로드
          </a>

          <form
            ref={formRef}
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              const formData = new FormData(e.currentTarget)
              setError(null)
              startTransition(async () => {
                const state = await bulkUploadPlantsAction({}, formData)
                if (state.error) {
                  setError(state.error)
                  return
                }
                if (state.result) {
                  const { created, updated, skipped, unknownClientGroups } =
                    state.result
                  toast.success(
                    `신규 ${created}건, 갱신 ${updated}건 처리했습니다.${
                      skipped > 0 ? ` (${skipped}건 건너뜀)` : ""
                    }`,
                  )
                  if (unknownClientGroups.length > 0) {
                    toast.error(
                      `등록되지 않은 거래처명: ${unknownClientGroups.join(", ")}`,
                    )
                  }
                  formRef.current?.reset()
                  setUploadOpen(false)
                }
              })
            }}
          >
            <input
              type="file"
              name="file"
              accept=".xlsx,.xls"
              required
              className="text-sm file:mr-3 file:rounded-lg file:border file:border-input file:bg-transparent file:px-2.5 file:py-1 file:text-sm"
            />
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? "업로드 중..." : "업로드"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
