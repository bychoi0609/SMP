"use client"

import { useRouter } from "next/navigation"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// 발전소 원장으로 바로 이동. 보고 있던 연도를 그대로 넘긴다.
export function PlantPicker({
  plants,
  year,
}: {
  plants: Array<{ id: number; label: string }>
  year: string
}) {
  const router = useRouter()

  return (
    <Select
      onValueChange={(value) => {
        if (value) router.push(`/reports/plants/${value}?year=${year}`)
      }}
    >
      <SelectTrigger className="w-64">
        <SelectValue placeholder="발전소 원장 바로가기" />
      </SelectTrigger>
      <SelectContent>
        {plants.map((plant) => (
          <SelectItem key={plant.id} value={String(plant.id)}>
            {plant.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
