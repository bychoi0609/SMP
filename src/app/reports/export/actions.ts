"use server"

import { saveReportLabelMappings } from "@/lib/report-fill/fill"
import type { ReportKind } from "@/lib/report-fill/workbook"

// 매핑 확인 표에서 고른 결과 저장(plantId null = 해당 없음).
export async function saveReportLabelMappingsAction(
  kind: ReportKind,
  items: Array<{ label: string; plantId: number | null }>,
): Promise<{ error?: string }> {
  try {
    await saveReportLabelMappings(kind, items)
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : "매핑을 저장하지 못했어요." }
  }
}
