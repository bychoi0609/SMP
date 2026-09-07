"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { assignPlantAction } from "./actions"

export function AssignPlantControl({
  smpMonthlyId,
  plantOptions,
}: {
  smpMonthlyId: number
  plantOptions: Array<{ id: number; plantName: string }>
}) {
  const [selected, setSelected] = useState<string | undefined>()
  const [isPending, startTransition] = useTransition()

  return (
    <div className="flex items-center justify-center gap-2">
      <Select
        value={selected}
        onValueChange={(value) => setSelected(value ?? undefined)}
      >
        <SelectTrigger className="w-32">
          <SelectValue placeholder="발전소 선택">
            {(value: string) =>
              value
                ? plantOptions.find((plant) => String(plant.id) === value)
                    ?.plantName
                : "발전소 선택"
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {plantOptions.map((plant) => (
            <SelectItem key={plant.id} value={String(plant.id)}>
              {plant.plantName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        size="sm"
        disabled={!selected || isPending}
        onClick={() => {
          if (!selected) return
          startTransition(async () => {
            await assignPlantAction(smpMonthlyId, Number(selected))
            toast.success("발전소를 연결했습니다.")
          })
        }}
      >
        {isPending ? "저장 중..." : "연결"}
      </Button>
    </div>
  )
}
