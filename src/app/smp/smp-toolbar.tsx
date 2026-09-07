"use client"

import { useState } from "react"

import { defaultBillingMonth } from "@/lib/date"
import { ActionsMenu } from "./actions-menu"
import { MonthSelect } from "./month-select"
import { ScanMailButton } from "./scan-mail-button"

export function SmpToolbar({
  initialHasData,
  clientGroupId,
  onDataChanged,
}: {
  initialHasData: boolean
  clientGroupId?: number
  // 메일 스캔/초기화처럼 이 툴바 바깥의 화면(수집 그리드 등)이 보여주는
  // 데이터를 바꾸는 동작이 끝났을 때 호출된다 — 그 화면이 직접 fetch해서
  // 들고 있는 상태는 이 툴바의 상태 변화만으로는 다시 불러와지지 않기 때문.
  onDataChanged?: () => void
}) {
  const [hasData, setHasData] = useState(initialHasData)
  const [targetMonth, setTargetMonth] = useState(defaultBillingMonth)

  return (
    <div className="flex gap-2">
      <MonthSelect value={targetMonth} onChange={setTargetMonth} />
      <ScanMailButton
        targetMonth={targetMonth}
        clientGroupId={clientGroupId}
        onScanComplete={() => {
          setHasData(true)
          onDataChanged?.()
        }}
      />
      <ActionsMenu
        disabled={!hasData}
        clientGroupId={clientGroupId}
        targetMonth={targetMonth}
        onReset={() => {
          setHasData(false)
          onDataChanged?.()
        }}
      />
    </div>
  )
}
