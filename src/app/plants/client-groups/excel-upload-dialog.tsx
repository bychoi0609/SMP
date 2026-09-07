"use client"

import { useRef, useState, useTransition } from "react"
import { Download, Upload } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { bulkUploadClientGroupsAction } from "./actions"

export function ExcelUploadDialog() {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const [isPending, startTransition] = useTransition()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <Upload /> 엑셀 업로드
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>거래처 엑셀 일괄 업로드</DialogTitle>
          <DialogDescription>
            샘플 파일 양식에 맞춰 작성한 뒤 업로드하면 거래처가 한 번에
            등록됩니다. 이미 등록된 거래처명은 내용이 갱신됩니다.
          </DialogDescription>
        </DialogHeader>

        <a
          href="/api/client-groups/sample"
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
              const state = await bulkUploadClientGroupsAction({}, formData)
              if (state.error) {
                setError(state.error)
                return
              }
              if (state.result) {
                const { created, updated, skipped } = state.result
                toast.success(
                  `신규 ${created}건, 갱신 ${updated}건 처리했습니다.${
                    skipped > 0 ? ` (필수값 누락으로 ${skipped}건 건너뜀)` : ""
                  }`,
                )
                formRef.current?.reset()
                setOpen(false)
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
  )
}
