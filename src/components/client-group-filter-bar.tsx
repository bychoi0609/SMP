"use client"

import { useRef } from "react"
import { useRouter } from "next/navigation"

import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const ALL_CLIENT_GROUPS = "all"

// SMP/REC/리포트/세금계산서/발전소관리 화면에서 공통으로 쓰는 거래처 구분 + 검색 라인.
// URL 쿼리스트링(client, q)을 갱신해 서버 컴포넌트가 다시 필터링하도록 한다.
export function ClientGroupFilterBar({
  basePath,
  clientGroups,
  selectedClientGroupId,
  query,
  extraParams,
  searchPlaceholder = "발전소명으로 검색",
}: {
  basePath: string
  clientGroups: Array<{ id: number; name: string }>
  selectedClientGroupId?: number
  query?: string
  extraParams?: Record<string, string>
  searchPlaceholder?: string
}) {
  const router = useRouter()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function navigate(next: { client?: string; q?: string }) {
    const params = new URLSearchParams(extraParams)
    const client =
      next.client ??
      (selectedClientGroupId ? String(selectedClientGroupId) : "")
    const q = next.q ?? query ?? ""
    if (client) params.set("client", client)
    if (q) params.set("q", q)
    const qs = params.toString()
    router.push(qs ? `${basePath}?${qs}` : basePath)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        items={[
          { value: ALL_CLIENT_GROUPS, label: "전체 거래처" },
          ...clientGroups.map((cg) => ({
            value: String(cg.id),
            label: cg.name,
          })),
        ]}
        value={
          selectedClientGroupId ? String(selectedClientGroupId) : ALL_CLIENT_GROUPS
        }
        onValueChange={(value) =>
          value &&
          navigate({ client: value === ALL_CLIENT_GROUPS ? "" : value })
        }
      >
        <SelectTrigger>
          <SelectValue placeholder="전체 거래처" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_CLIENT_GROUPS}>전체 거래처</SelectItem>
          {clientGroups.map((cg) => (
            <SelectItem key={cg.id} value={String(cg.id)}>
              {cg.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        className="w-40"
        placeholder={searchPlaceholder}
        defaultValue={query ?? ""}
        onChange={(e) => {
          const value = e.target.value
          if (debounceRef.current) clearTimeout(debounceRef.current)
          debounceRef.current = setTimeout(() => navigate({ q: value }), 400)
        }}
      />
    </div>
  )
}
