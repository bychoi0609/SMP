// PRD §3 용어정의: 미청구 → SMP확정 → 확정(SMP·REC 모두 완료)
export type BillingStatus = "미청구" | "SMP확정" | "확정"

export function computeBillingStatus(
  smpIssued: boolean,
  recConfirmed: boolean,
): BillingStatus {
  if (!smpIssued) return "미청구"
  if (recConfirmed) return "확정"
  return "SMP확정"
}
