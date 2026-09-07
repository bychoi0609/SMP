"use client"

import { useState, useTransition } from "react"
import { Layers } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { ClientGroupOption } from "../plants/plant-form"
import { bulkCreatePlantsFromSmpAction } from "./actions"

export function BulkRegisterDialog({
  selectedRows,
  clientGroups,
  onDone,
}: {
  selectedRows: Array<{ id: number; plantName: string }>
  clientGroups: ClientGroupOption[]
  onDone: () => void
}) {
  const [open, setOpen] = useState(false)
  const [clientGroupId, setClientGroupId] = useState("")
  const [isPending, startTransition] = useTransition()

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setClientGroupId("")
      }}
    >
      <DialogTrigger render={<Button size="sm" />}>
        <Layers /> 선택 {selectedRows.length}건 일괄 등록
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>선택 항목 일괄 신규 등록</DialogTitle>
          <DialogDescription>
            메일에서 추출된 발전소명·계약번호·종사업장번호로 {selectedRows.length}
            개 발전소를 한 번에 등록합니다. 모두 같은 거래처로 등록되며, 별칭 등
            나머지 정보는 발전소관리에서 나중에 수정할 수 있습니다.
          </DialogDescription>
        </DialogHeader>

        <ul className="max-h-48 list-disc overflow-y-auto rounded-lg border p-3 pl-8 text-sm">
          {selectedRows.map((row) => (
            <li key={row.id}>{row.plantName || "(발전소명 없음)"}</li>
          ))}
        </ul>

        <Field>
          <FieldLabel htmlFor="bulk-client-group">거래처 *</FieldLabel>
          {clientGroups.length === 0 ? (
            <FieldDescription>
              등록된 거래처가 없습니다. 발전소관리에서 거래처를 먼저 추가해
              주세요.
            </FieldDescription>
          ) : (
            <Select
              value={clientGroupId}
              onValueChange={(value) => setClientGroupId(value ?? "")}
            >
              <SelectTrigger id="bulk-client-group" className="w-full">
                <SelectValue placeholder="거래처 선택">
                  {(value: string) =>
                    value
                      ? clientGroups.find(
                          (group) => String(group.id) === value,
                        )?.name
                      : "거래처 선택"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {clientGroups.map((group) => (
                  <SelectItem key={group.id} value={String(group.id)}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>

        <DialogFooter>
          <Button
            disabled={!clientGroupId || isPending}
            onClick={() => {
              startTransition(async () => {
                const state = await bulkCreatePlantsFromSmpAction(
                  selectedRows.map((row) => row.id),
                  Number(clientGroupId),
                )
                if (state.error) {
                  toast.error(state.error)
                  return
                }
                if (state.result) {
                  const { created, skipped, skippedDetails } = state.result
                  toast.success(
                    `${created}건 신규 등록했습니다.${
                      skipped > 0 ? ` (${skipped}건 실패)` : ""
                    }`,
                  )
                  if (skippedDetails.length > 0) {
                    toast.error(`등록 실패: ${skippedDetails.join(", ")}`)
                  }
                }
                setOpen(false)
                setClientGroupId("")
                onDone()
              })
            }}
          >
            {isPending ? "등록 중..." : `${selectedRows.length}건 일괄 등록`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
