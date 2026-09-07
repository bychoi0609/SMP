import { useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { Card } from './ui/card'
import { Button } from './ui/button'
import { cn } from '@/lib/utils'

interface FileDropzoneProps {
  onFiles: (files: File[]) => void
  label?: string
  buttonLabel?: string
  compact?: boolean
}

export function FileDropzone({
  onFiles,
  label = '세금계산서(홈택스) / 영수증(카드사) 원본 엑셀 파일을 여기로 드래그하세요.',
  buttonLabel = '파일 선택',
  compact = false,
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files.length > 0) onFiles(Array.from(e.dataTransfer.files))
  }

  return (
    <Card
      className={cn(
        'mb-4 border-2 border-dashed text-center transition-colors',
        compact ? 'p-[18px]' : 'p-8',
        isDragOver && 'border-ring bg-accent',
      )}
      onDragOver={(e) => {
        e.preventDefault()
        setIsDragOver(true)
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
    >
      <p className="whitespace-pre-line">{label}</p>
      <Button className="mt-3" onClick={() => inputRef.current?.click()}>
        {buttonLabel}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".xls,.xlsx"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            onFiles(Array.from(e.target.files))
          }
          e.target.value = ''
        }}
      />
    </Card>
  )
}
