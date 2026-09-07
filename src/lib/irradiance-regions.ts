// 수평면 일사량 매칭 기준 지역 목록 (발전소 마스터의 "수평면 일사량" 칼럼에서
// 선택하고, 보고서 모달의 지역별 일사량 입력에서도 동일한 목록을 사용한다).
export const IRRADIANCE_REGIONS = [
  "경주",
  "양산",
  "포항",
  "함양",
  "의령",
  "북창원",
  "수원",
  "대전",
  "부산",
  "울산",
] as const

export type IrradianceRegion = (typeof IRRADIANCE_REGIONS)[number]

export function isIrradianceRegion(value: string): value is IrradianceRegion {
  return (IRRADIANCE_REGIONS as readonly string[]).includes(value)
}
