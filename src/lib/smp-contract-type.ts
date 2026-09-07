// 계약번호로 SMP 계약 상대방을 구분한다.
// - 계약번호가 있으면(보통 "50000"으로 시작) 한국전력공사와 SMP계약이 된 발전소.
// - 계약번호가 비어 있으면 한국전력거래소(KPX)와 SMP계약이 된 발전소로,
//   한전 요금안내 메일이 오지 않아 발전량 등을 수기로 입력해야 한다.
export const KEPCO_CONTRACT_NUMBER_PREFIX = "50000"

export type SmpContractType = "KEPCO" | "KPX"

export function getSmpContractType(
  contractNumber: string | null | undefined,
): SmpContractType {
  return contractNumber ? "KEPCO" : "KPX"
}

export const SMP_CONTRACT_TYPE_LABEL: Record<SmpContractType, string> = {
  KEPCO: "한국전력공사",
  KPX: "한국전력거래소",
}
