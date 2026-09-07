// REC수량 예상치 계산. 정식 REC대금청구서가 도착하기 전까지 SMP 발전량으로
// 수량을 추정해 보여주며, 청구 확정 시 사용자가 실제 값으로 덮어쓴다.
// 기본 배율은 1.5이며, 아래 예외 발전소만 1.2를 적용한다.
const REDUCED_MULTIPLIER_PLANTS = new Set(["서울청과연구소"])

export function getRecQuantityMultiplier(plantName: string): number {
  return REDUCED_MULTIPLIER_PLANTS.has(plantName) ? 1.2 : 1.5
}

export function estimateRecQuantity(
  generationKwh: number,
  plantName: string,
): number {
  return Math.trunc(
    (generationKwh * getRecQuantityMultiplier(plantName)) / 1000,
  )
}
