"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

function formatLabel(month: string): string {
  const [year, m] = month.split("-")
  return `${year}년 ${Number(m)}월`
}

// 적용월(발전기간 해당월) 후보 목록: 현재 월 기준 ±5년(오름차순).
function buildMonthOptions(): string[] {
  const now = new Date()
  const months: string[] = []
  for (let offset = -60; offset <= 60; offset++) {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
  }
  return months
}

export function MonthSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (month: string) => void
}) {
  const options = buildMonthOptions()

  return (
    <Select value={value} onValueChange={(v) => v && onChange(v)}>
      <SelectTrigger className="w-36">
        <SelectValue placeholder="적용월 선택">
          {(v: string) => (v ? formatLabel(v) : "적용월 선택")}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-[20vh]">
        {options.map((m) => (
          <SelectItem key={m} value={m}>
            {formatLabel(m)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
