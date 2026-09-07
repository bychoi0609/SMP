export function formatAmount(value: unknown): string {
  if (value === null || value === undefined) return "-"
  return Number(value).toLocaleString("ko-KR")
}

export function formatNumber(value: unknown, digits = 0): string {
  if (value === null || value === undefined) return "-"
  return Number(value).toLocaleString("ko-KR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}
