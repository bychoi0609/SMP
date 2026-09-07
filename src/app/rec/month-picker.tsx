"use client"

import { useRouter } from "next/navigation"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function MonthPicker({
  months,
  selected,
  extraParams,
}: {
  months: string[]
  selected: string
  extraParams?: Record<string, string>
}) {
  const router = useRouter()

  return (
    <Select
      value={selected}
      onValueChange={(value) => {
        if (!value) return
        const params = new URLSearchParams(extraParams)
        params.set("month", value)
        router.push(`/rec?${params.toString()}`)
      }}
    >
      <SelectTrigger className="w-40">
        <SelectValue placeholder="귀속월 선택" />
      </SelectTrigger>
      <SelectContent>
        {months.map((m) => (
          <SelectItem key={m} value={m}>
            {m}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
