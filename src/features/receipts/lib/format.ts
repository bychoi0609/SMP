// 쉼표가 포함된 금액 문자열("110,000")을 숫자로 변환. 빈 값은 0.
export function parseAmount(raw: unknown): number {
  if (raw === null || raw === undefined || raw === '') return 0
  const cleaned = String(raw).replace(/,/g, '').trim()
  if (cleaned === '') return 0
  const n = Number(cleaned)
  return Number.isNaN(n) ? 0 : n
}

// "2026-07-31", "2026.07.06", "2026-08-05 09:14:13" 등을 "YYYY-MM-DD"로 정규화.
export function parseDateOnly(raw: unknown): string {
  if (raw === null || raw === undefined) return ''
  const s = String(raw).trim()
  if (s === '') return ''
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`
  const dotMatch = s.match(/^(\d{4})\.(\d{2})\.(\d{2})/)
  if (dotMatch) return `${dotMatch[1]}-${dotMatch[2]}-${dotMatch[3]}`
  return s
}

export function cellText(raw: unknown): string {
  if (raw === null || raw === undefined) return ''
  return String(raw).trim()
}

export function formatNumber(n: number): string {
  return n.toLocaleString('ko-KR')
}

// localStorage에 남아있는 예전 스키마(필드 추가 전) 데이터에는 일부 필드가 undefined일 수 있어
// 방어적으로 걸러낸다.
export function uniqueNonEmpty(values: (string | undefined | null)[]): string[] {
  return [...new Set(values.map((v) => (v ?? '').trim()).filter((v) => v !== ''))]
}
