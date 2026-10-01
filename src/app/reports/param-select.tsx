"use client"

import { useRouter } from "next/navigation"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// URL 쿼리 하나(연도, 보기 항목 등)를 바꾸는 선택 상자. 나머지 쿼리는 params로 유지한다.
export function ParamSelect({
  basePath,
  name,
  value,
  options,
  params,
  className = "w-36",
}: {
  basePath: string
  name: string
  value: string
  options: Array<{ value: string; label: string }>
  params?: Record<string, string>
  className?: string
}) {
  const router = useRouter()

  return (
    <Select
      items={options}
      value={value}
      onValueChange={(next) => {
        if (!next) return
        const search = new URLSearchParams(params)
        search.set(name, String(next))
        router.push(`${basePath}?${search.toString()}`)
      }}
    >
      <SelectTrigger className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
