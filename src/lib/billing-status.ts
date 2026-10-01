// PRD §3 용어정의: 미청구 → SMP확정 → 확정(SMP·REC 모두 완료)
// - SMP확정: 거래처·귀속월 단위 SMP 데이터 확정(SmpMonthlyConfirmation CONFIRMED)
// - 확정: 그 위에 REC 수량·단가까지 확정(isRecSettled)
// 세금계산서 발행 여부는 상태와 별개다(SmpMonthlyConfirmation.invoiceIssuedAt).
export type BillingStatus = "미청구" | "SMP확정" | "확정"

export function computeBillingStatus(
  smpConfirmed: boolean,
  recConfirmed: boolean,
): BillingStatus {
  if (!smpConfirmed) return "미청구"
  if (recConfirmed) return "확정"
  return "SMP확정"
}

// REC가 확정됐는지. 수량만 입력되고 단가가 비어 있으면 아직 확정이 아니며,
// 발전이 없던 달(수량 0)은 단가 없이도 확정으로 본다.
export function isRecSettled(
  rec:
    | {
        status: "TENTATIVE" | "CONFIRMED" | null
        quantity: number | null
        unitPrice: number | null
      }
    | null
    | undefined,
): boolean {
  if (!rec || rec.status !== "CONFIRMED") return false
  return rec.quantity === 0 || (rec.unitPrice ?? 0) > 0
}

// 거래처·귀속월 조합 키 (getConfirmedSmpKeys와 함께 사용).
export function smpConfirmationKey(clientGroupId: number, billingYearMonth: string) {
  return `${clientGroupId}-${billingYearMonth}`
}
