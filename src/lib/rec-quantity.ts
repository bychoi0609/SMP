// REC수량 예상치 계산. 정식 REC대금청구서가 도착하기 전까지 SMP 발전량으로
// 수량을 추정해 보여주며, 청구 확정 시 사용자가 실제 발급량으로 덮어쓴다.
// 가중치는 발전소관리에서 발전소별로 관리한다(PlantMaster.recWeight, 기본 1.5).
export function estimateRecQuantity(
  generationKwh: number,
  recWeight: number,
): number {
  return Math.trunc((generationKwh * recWeight) / 1000)
}
