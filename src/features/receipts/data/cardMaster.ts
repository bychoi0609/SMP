export interface CardMasterEntry {
  last4: string // 카드번호 뒤 4자리
  name: string // 이용자명 (없으면 빈 문자열 — 예: 하이패스)
}

// PRD 7.2.3 카드 마스터 목록 (초기 시드 데이터)
export const DEFAULT_CARD_MASTER: CardMasterEntry[] = [
  { last4: '1807', name: '임채환' },
  { last4: '4506', name: '경영관리팀' },
  { last4: '5808', name: '임호성' },
  { last4: '0803', name: '이근복' },
  { last4: '0603', name: '정희만' },
  { last4: '6003', name: '주관호' },
  { last4: '7928', name: '' }, // 하이패스
  { last4: '9822', name: '' }, // 하이패스
  { last4: '8127', name: '' }, // 하이패스
  { last4: '9519', name: '' }, // 하이패스
  { last4: '6510', name: '' }, // 하이패스
  { last4: '8302', name: '임호성' }, // 보조 카드
  { last4: '2931', name: '임채환' }, // 보조 카드
  { last4: '0908', name: '경영관리팀' }, // 보조 카드
]

export function cardSheetName(entry: CardMasterEntry): string {
  return entry.name ? `${entry.last4} ${entry.name}` : entry.last4
}
