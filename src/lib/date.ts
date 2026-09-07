// 기본 적용월: 전월(가장 최근에 한전 메일이 도착했을 발전기간).
export function defaultBillingMonth(): string {
  const now = new Date()
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

// "YYYY-MM" 형식의 귀속월이 속한 달의 총 일수.
export function daysInMonth(month: string): number {
  const [year, m] = month.split("-").map(Number)
  return new Date(year, m, 0).getDate()
}
