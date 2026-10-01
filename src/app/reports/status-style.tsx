import type { BillingStatus } from "@/lib/billing-status"
import { cn } from "@/lib/utils"

// 매출 현황·발전소 원장의 값 글씨 모양. 확정은 기본, SMP확정은 흐리게,
// 미청구(SMP 데이터 확정 전)는 흐린 글씨에 점선 밑줄.
export function statusTextClass(status: BillingStatus): string {
  if (status === "확정") return ""
  if (status === "SMP확정") return "text-muted-foreground"
  return "text-muted-foreground underline decoration-dotted underline-offset-4"
}

export function StatusLegend() {
  const items: BillingStatus[] = ["확정", "SMP확정", "미청구"]
  return (
    <p className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      {items.map((status) => (
        <span key={status} className="flex items-center gap-1">
          <span className={cn("font-medium tabular-nums text-foreground", statusTextClass(status))}>
            1,234
          </span>
          {status === "확정"
            ? "확정 (SMP·REC 완료)"
            : status === "SMP확정"
              ? "SMP확정 (REC 대기)"
              : "미청구 (SMP 확정 전)"}
        </span>
      ))}
    </p>
  )
}
