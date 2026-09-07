"use client"

import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { IRRADIANCE_REGIONS } from "@/lib/irradiance-regions"
import {
  getSolarIrradianceMonthlyAction,
  upsertSolarIrradianceMonthlyAction,
} from "./actions"

export function IrradianceDialog({
  open,
  onOpenChange,
  month,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  month: string
  onSaved: (values: Record<string, number | null>) => void
}) {
  const [values, setValues] = useState<Record<string, number | null>>({})
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [isLoading, startLoading] = useTransition()
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!open) return
    startLoading(async () => {
      const result = await getSolarIrradianceMonthlyAction(month)
      setValues(result)
      setDrafts(
        Object.fromEntries(
          Object.entries(result).map(([region, value]) => [
            region,
            value !== null ? String(value) : "",
          ]),
        ),
      )
    })
  }, [open, month])

  function commit(region: string) {
    const trimmed = (drafts[region] ?? "").trim()
    if (trimmed === "") return
    const num = Number(trimmed)
    if (Number.isNaN(num) || num === values[region]) return
    startTransition(async () => {
      const result = await upsertSolarIrradianceMonthlyAction(month, region, num)
      if (result.error) {
        toast.error(result.error)
        return
      }
      const next = { ...values, [region]: num }
      setValues(next)
      onSaved(next)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>수평면 일사량 ({month})</DialogTitle>
          <DialogDescription>
            지역별 해당월 수평면 일사량을 입력하면 발전소 마스터에 설정한
            지역에 따라 보고서에 자동으로 매칭됩니다.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          {IRRADIANCE_REGIONS.map((region) => (
            <div key={region} className="flex items-center gap-2">
              <label className="w-16 shrink-0 text-sm text-muted-foreground">
                {region}
              </label>
              <Input
                type="text"
                inputMode="decimal"
                disabled={isLoading || isPending}
                value={drafts[region] ?? ""}
                onChange={(e) =>
                  setDrafts((prev) => ({ ...prev, [region]: e.target.value }))
                }
                onBlur={() => commit(region)}
                className="text-right"
              />
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
