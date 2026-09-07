"use client"

import { useState, useTransition } from "react"
import JSZip from "jszip"
import { FileSpreadsheet, FileText } from "lucide-react"
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
import { Progress } from "@/components/ui/progress"

type SaveFilePicker = (options: {
  suggestedName: string
  types: { description: string; accept: Record<string, string[]> }[]
}) => Promise<FileSystemFileHandleLike>

type FileSystemFileHandleLike = {
  createWritable: () => Promise<{
    write: (data: Blob) => Promise<void>
    close: () => Promise<void>
  }>
}

type DirectoryHandleLike = {
  getFileHandle: (
    name: string,
    opts: { create: boolean },
  ) => Promise<FileSystemFileHandleLike>
  getDirectoryHandle: (
    name: string,
    opts: { create: boolean },
  ) => Promise<DirectoryHandleLike>
}

type DirectoryPicker = () => Promise<DirectoryHandleLike>

type PdfStreamEvent =
  | { type: "meta"; total: number }
  | { type: "file"; fileName: string; base64: string }
  | { type: "done" }
  | { type: "error"; message: string }

// PDF 생성 API가 내려주는 NDJSON(줄바꿈으로 구분된 JSON) 스트림을 한 줄씩 읽어
// 이벤트로 넘겨준다 — 서버가 건별 렌더링을 마칠 때마다 즉시 진행률을 반영할 수 있도록.
async function* readNdjsonEvents(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<PdfStreamEvent> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let newlineIndex: number
      while ((newlineIndex = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newlineIndex)
        buffer = buffer.slice(newlineIndex + 1)
        if (line.trim()) yield JSON.parse(line) as PdfStreamEvent
      }
    }
    if (buffer.trim()) yield JSON.parse(buffer) as PdfStreamEvent
  } finally {
    await reader.cancel().catch(() => {})
  }
}

function isAbort(err: unknown) {
  return err instanceof Error && err.name === "AbortError"
}

function fallbackDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function base64ToBlob(base64: string, mime: string): Blob {
  const byteChars = atob(base64)
  const bytes = new Uint8Array(byteChars.length)
  for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

export function DownloadDialog({
  open,
  onOpenChange,
  targetMonth,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  targetMonth: string
}) {
  const [isPending, startTransition] = useTransition()
  const [progress, setProgress] = useState<{
    completed: number
    total: number
  } | null>(null)

  const handleExcel = () => {
    startTransition(async () => {
      const res = await fetch(`/api/smp/export?month=${targetMonth}`)
      if (!res.ok) {
        toast.error("엑셀 파일을 만들지 못했습니다.")
        return
      }
      const blob = await res.blob()
      const fileName = `SMP_${targetMonth}.xlsx`

      const showSaveFilePicker = (
        window as unknown as { showSaveFilePicker?: SaveFilePicker }
      ).showSaveFilePicker

      if (showSaveFilePicker) {
        try {
          const handle = await showSaveFilePicker({
            suggestedName: fileName,
            types: [
              {
                description: "Excel 파일",
                accept: {
                  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
                    [".xlsx"],
                },
              },
            ],
          })
          const writable = await handle.createWritable()
          await writable.write(blob)
          await writable.close()
          toast.success("저장했습니다.")
          onOpenChange(false)
          return
        } catch (err) {
          if (isAbort(err)) return
        }
      }

      fallbackDownload(blob, fileName)
      if (!showSaveFilePicker) {
        toast.info(
          "이 브라우저/접속 환경에서는 저장 위치를 직접 고를 수 없어 기본 다운로드 폴더에 저장했습니다.",
        )
      }
      onOpenChange(false)
    })
  }

  const handlePdf = () => {
    startTransition(async () => {
      setProgress(null)
      const res = await fetch(`/api/smp/export-pdf?month=${targetMonth}`)
      if (!res.ok || !res.body) {
        toast.error("PDF를 만들지 못했습니다.")
        return
      }

      const showDirectoryPicker = (
        window as unknown as { showDirectoryPicker?: DirectoryPicker }
      ).showDirectoryPicker

      const zippedFiles: { fileName: string; base64: string }[] = []
      let monthHandle: DirectoryHandleLike | null = null
      let total = 0
      let errorMessage: string | null = null

      try {
        for await (const event of readNdjsonEvents(res.body)) {
          if (event.type === "meta") {
            total = event.total
            if (total === 0) {
              toast.error("선택한 월의 변환할 메일 데이터가 없습니다.")
              return
            }
            setProgress({ completed: 0, total })

            if (showDirectoryPicker) {
              try {
                const rootHandle = await showDirectoryPicker()
                monthHandle = await rootHandle.getDirectoryHandle(
                  targetMonth,
                  { create: true },
                )
              } catch (err) {
                if (isAbort(err)) return
                // 폴더 선택 실패 — 압축 파일 대체 다운로드로 계속 진행
              }
            }
          } else if (event.type === "file") {
            if (monthHandle) {
              const blob = base64ToBlob(event.base64, "application/pdf")
              const fileHandle = await monthHandle.getFileHandle(
                event.fileName,
                { create: true },
              )
              const writable = await fileHandle.createWritable()
              await writable.write(blob)
              await writable.close()
            } else {
              zippedFiles.push({
                fileName: event.fileName,
                base64: event.base64,
              })
            }
            setProgress((prev) =>
              prev ? { ...prev, completed: prev.completed + 1 } : prev,
            )
          } else if (event.type === "error") {
            errorMessage = event.message
          }
        }
      } finally {
        setProgress(null)
      }

      if (errorMessage) {
        toast.error(`PDF 생성 중 오류가 발생했습니다: ${errorMessage}`)
        return
      }

      if (monthHandle) {
        toast.success(`PDF ${total}건을 "${targetMonth}" 폴더에 저장했습니다.`)
        onOpenChange(false)
        return
      }

      // 폴더 선택을 지원하지 않는 환경 — 압축 파일 하나로 대체 다운로드
      const zip = new JSZip()
      for (const file of zippedFiles) {
        zip.file(file.fileName, file.base64, { base64: true })
      }
      const zipBlob = await zip.generateAsync({ type: "blob" })
      fallbackDownload(zipBlob, `SMP_PDF_${targetMonth}.zip`)
      if (!showDirectoryPicker) {
        toast.info(
          "이 브라우저/접속 환경에서는 저장 폴더를 직접 고를 수 없어 압축 파일로 다운로드했습니다.",
        )
      }
      onOpenChange(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>SMP 데이터 다운로드</DialogTitle>
          <DialogDescription>
            매칭 여부와 상관없이 선택한 적용월({targetMonth})에 수집된 전체
            데이터를 내보냅니다. PDF는 원본 메일을 그대로 인쇄한 형태로
            저장됩니다.
          </DialogDescription>
        </DialogHeader>
        {progress && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>PDF 생성 중...</span>
              <span className="tabular-nums">
                {progress.completed} / {progress.total}
              </span>
            </div>
            <Progress
              value={
                progress.total > 0
                  ? (progress.completed / progress.total) * 100
                  : 0
              }
            />
          </div>
        )}
        <DialogFooter className="grid grid-cols-2 gap-2 sm:flex-row">
          <Button variant="outline" disabled={isPending} onClick={handleExcel}>
            <FileSpreadsheet /> 엑셀로 저장
          </Button>
          <Button disabled={isPending} onClick={handlePdf}>
            <FileText /> {isPending ? "처리 중..." : "PDF로 저장"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
