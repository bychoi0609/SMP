import type { ReceiptRow } from '../types/tables'

// 영수증 "내역"에 키워드가 포함되면 계정과목을 자동 입력하는 고정 규칙 (코드 고정, 화면에서 편집하지 않음).
// 여러 키워드가 동시에 포함되면 목록에서 먼저 나온 규칙이 우선한다.
const DESCRIPTION_KEYWORD_RULES: ReadonlyArray<{ keyword: string; accountCode: string }> = [
  { keyword: '식대', accountCode: '복리후생비' },
  { keyword: '음료비', accountCode: '복리후생비' },
  { keyword: '유류비', accountCode: '차량유지비' },
  { keyword: '공임', accountCode: '차량유지비' },
  { keyword: '워셔액', accountCode: '차량유지비' },
  { keyword: '엔진오일', accountCode: '차량유지비' },
  { keyword: '주차비', accountCode: '차량유지비' },
  { keyword: '숙박비', accountCode: '여비교통비' },
  { keyword: '기차', accountCode: '여비교통비' },
  { keyword: '버스', accountCode: '여비교통비' },
  { keyword: '택시', accountCode: '여비교통비' },
  { keyword: '수수료', accountCode: '지급수수료' },
  { keyword: '사용전검사', accountCode: '지급수수료' },
  { keyword: '정기검사', accountCode: '지급수수료' },
  { keyword: '자재', accountCode: '소모품비' },
  { keyword: '물품', accountCode: '소모품비' },
  { keyword: '실리콘', accountCode: '소모품비' },
  { keyword: '자물쇠', accountCode: '소모품비' },
  { keyword: '볼트', accountCode: '소모품비' },
  { keyword: '컴퓨터', accountCode: '비품' },
  { keyword: '택배', accountCode: '운반비' },
  { keyword: '운송', accountCode: '운반비' },
  { keyword: '화환', accountCode: '접대비' },
  { keyword: '우편', accountCode: '통신비' },
  { keyword: '등기', accountCode: '통신비' },
]

export function findAccountCodeForDescription(description: string): string | null {
  const text = description.trim()
  if (!text) return null
  return DESCRIPTION_KEYWORD_RULES.find((r) => text.includes(r.keyword))?.accountCode ?? null
}

// 계정과목이 비어있는 행에만 채운다 — 직접 입력했거나 가맹점명 규칙으로 이미 채워진 값은 덮어쓰지 않음.
export function applyDescriptionRule(row: ReceiptRow): ReceiptRow {
  if (row.accountCode) return row
  const accountCode = findAccountCodeForDescription(row.description)
  return accountCode ? { ...row, accountCode } : row
}
