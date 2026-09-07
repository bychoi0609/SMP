"use client"

import { useRouter } from "next/navigation"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function PlantPicker({
  plants,
}: {
  plants: Array<{ id: number; plantName: string; plantAlias: string | null }>
}) {
  const router = useRouter()

  return (
    <Select
      onValueChange={(value) => {
        if (value) router.push(`/reports/plants/${value}`)
      }}
    >
      <SelectTrigger className="w-72">
        <SelectValue placeholder="발전소를 선택해 월별 추이 보기" />
      </SelectTrigger>
      <SelectContent>
        {plants.map((plant) => (
          <SelectItem key={plant.id} value={String(plant.id)}>
            {plant.plantAlias ?? plant.plantName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
