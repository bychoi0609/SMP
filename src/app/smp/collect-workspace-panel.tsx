"use client"

import { useState } from "react"

import { SmpToolbar } from "./smp-toolbar"
import type { ReportPlant } from "./actions"
import { CollectionWorkspace } from "./collection-workspace"

// SmpToolbar(메일 스캔/초기화)와 CollectionWorkspace(수집 그리드)는 각자 데이터를
// 따로 들고 있어서, 툴바에서 데이터를 바꿔도 그리드가 자동으로 다시 불러오지
// 않는다. refreshKey를 올려 그리드를 다시 마운트시켜 최신 데이터로 갱신한다.
export function CollectWorkspacePanel({
  clientGroupId,
  query,
  initialHasData,
  initialPlants,
}: {
  clientGroupId?: number
  query?: string
  initialHasData: boolean
  initialPlants: ReportPlant[]
}) {
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <SmpToolbar
          initialHasData={initialHasData}
          clientGroupId={clientGroupId}
          onDataChanged={() => setRefreshKey((k) => k + 1)}
        />
      </div>
      <CollectionWorkspace
        key={refreshKey}
        clientGroupId={clientGroupId}
        query={query}
        initialPlants={initialPlants}
      />
    </div>
  )
}
