"use client"

import { useMemo, useState } from "react"

import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ClientGroupOption } from "../plants/plant-form"
import { AssignPlantControl } from "./assign-plant-control"
import { BulkRegisterDialog } from "./bulk-register-dialog"
import { RegisterPlantDialog } from "./register-plant-dialog"

export type NeedsReviewRow = {
  id: number
  extractedPlantName: string | null
  extractedContractNumber: string | null
  extractedSubBizNumber: string | null
  extractedKepcoContactEmail: string | null
  extractedAddress: string | null
  extractedCapacityKw: number | null
  billingYearMonth: string
  supplyAmount: number | null
  mailFolder: string | null
}

function formatAmount(value: number | null) {
  if (value === null) return "-"
  return value.toLocaleString("ko-KR")
}

export function NeedsReviewPanel({
  rows,
  plantOptions,
  clientGroups,
  nextConstructionOrder,
}: {
  rows: NeedsReviewRow[]
  plantOptions: Array<{ id: number; plantName: string }>
  clientGroups: ClientGroupOption[]
  nextConstructionOrder: number
}) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  // 발전소명/계약번호/종사업장번호가 모두 추출된 행만 자동 일괄 등록이 가능하다.
  const selectableIds = useMemo(
    () =>
      new Set(
        rows
          .filter(
            (row) =>
              row.extractedPlantName &&
              row.extractedContractNumber &&
              row.extractedSubBizNumber,
          )
          .map((row) => row.id),
      ),
    [rows],
  )
  const allSelectableSelected =
    selectableIds.size > 0 &&
    [...selectableIds].every((id) => selectedIds.has(id))

  function toggleRow(id: number, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const selectedRows = rows.filter((row) => selectedIds.has(row.id))

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold text-destructive">
            검토 필요 ({rows.length}건)
          </h2>
          <p className="text-sm text-muted-foreground">
            발전소를 자동으로 매칭하지 못했습니다. 기존 발전소에 연결하거나,
            아직 등록되지 않은 발전소라면 신규로 등록해 주세요.
          </p>
        </div>
        {selectedRows.length > 0 && (
          <BulkRegisterDialog
            selectedRows={selectedRows.map((row) => ({
              id: row.id,
              plantName: row.extractedPlantName ?? "",
            }))}
            clientGroups={clientGroups}
            onDone={() => setSelectedIds(new Set())}
          />
        )}
      </div>
      <div className="overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 text-center !pl-4 !pr-2">
                <Checkbox
                  checked={allSelectableSelected}
                  disabled={selectableIds.size === 0}
                  onCheckedChange={(checked) =>
                    setSelectedIds(
                      checked === true ? new Set(selectableIds) : new Set(),
                    )
                  }
                  aria-label="전체 선택"
                />
              </TableHead>
              <TableHead className="w-10 text-center">순번</TableHead>
              <TableHead className="w-55">메일에서 추출된 발전소명</TableHead>
              <TableHead className="w-28">귀속월</TableHead>
              <TableHead className="w-36 text-center">공급가액</TableHead>
              <TableHead className="w-36">메일함</TableHead>
              <TableHead className="w-55 pr-1">발전소 연결</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow key={row.id}>
                <TableCell className="text-center !pl-4 !pr-2">
                  <Checkbox
                    checked={selectedIds.has(row.id)}
                    disabled={!selectableIds.has(row.id)}
                    onCheckedChange={(checked) =>
                      toggleRow(row.id, checked === true)
                    }
                    aria-label={`${row.extractedPlantName ?? "행"} 선택`}
                  />
                </TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {index + 1}
                </TableCell>
                <TableCell className="font-medium">
                  {row.extractedPlantName ?? "(추출 실패)"}
                </TableCell>
                <TableCell>{row.billingYearMonth}</TableCell>
                <TableCell className="tabular-nums">
                  {formatAmount(row.supplyAmount)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {row.mailFolder}
                </TableCell>
                <TableCell className="pr-1">
                  <div className="flex flex-col items-start gap-2">
                    <AssignPlantControl
                      smpMonthlyId={row.id}
                      plantOptions={plantOptions}
                    />
                    <RegisterPlantDialog
                      smpMonthlyId={row.id}
                      clientGroups={clientGroups}
                      defaultValues={{
                        plantName: row.extractedPlantName ?? "",
                        plantAlias: "",
                        contractNumber: row.extractedContractNumber ?? "",
                        subBizNumber: row.extractedSubBizNumber ?? "",
                        kepcoContactEmail: row.extractedKepcoContactEmail ?? "",
                        address: row.extractedAddress ?? "",
                        capacityKw: row.extractedCapacityKw,
                        constructionOrder: nextConstructionOrder,
                        clientGroupId: null,
                        irradianceRegion: "",
                      }}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
