"use client"

import { useState } from "react"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  PlantForm,
  type ClientGroupOption,
  type PlantFormDefaults,
} from "../plants/plant-form"
import { createPlantFromSmpAction } from "./actions"

export function RegisterPlantDialog({
  smpMonthlyId,
  defaultValues,
  clientGroups,
}: {
  smpMonthlyId: number
  defaultValues: PlantFormDefaults
  clientGroups: ClientGroupOption[]
}) {
  const [open, setOpen] = useState(false)
  const boundAction = createPlantFromSmpAction.bind(null, smpMonthlyId)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <Plus /> 신규 발전소로 등록
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>신규 발전소 등록</DialogTitle>
          <DialogDescription>
            메일에서 추출된 정보로 아래 항목을 미리 채워뒀습니다. 거래처를
            선택하고 등록하면 이 SMP 데이터가 바로 연결됩니다.
          </DialogDescription>
        </DialogHeader>
        <PlantForm
          action={boundAction}
          defaultValues={defaultValues}
          clientGroups={clientGroups}
          submitLabel="등록하고 연결"
        />
      </DialogContent>
    </Dialog>
  )
}
