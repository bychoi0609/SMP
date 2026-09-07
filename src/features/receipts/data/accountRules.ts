export type AccountRuleDivision = '매출' | '매입' | '영수증'

export interface AccountRuleEntry {
  division: AccountRuleDivision // 이 규칙이 적용될 카테고리 (매출/매입 세금계산서 또는 영수증)
  bizNo: string // 사업자등록번호 (상대 거래처) — 매출/매입 매칭에만 사용
  vendorName: string // 상호 — 매출/매입은 참고용 표시일 뿐 매칭에 쓰지 않음. 영수증은 가맹점명 부분포함 매칭에 사용.
  itemPattern: string // 품목명에 포함되어야 하는 부분 문자열 (매출/매입 전용, 빈 문자열 = 해당 사업자의 모든 거래)
  accountName: string // 계정과목
  siteCode: number | null // 구분번호 — 규칙이 계정과목을 채울 때 함께 자동 입력(미설정 시 null)
  note: string // 비고 — 규칙이 계정과목을 채울 때 함께 자동 입력(빈 문자열 = 미설정)
  project: string // 프로젝트 — 규칙이 계정과목을 채울 때 함께 자동 입력(빈 문자열 = 미설정)
  paymentBasisAccount: string // 대금기준 — 규칙이 계정과목을 채울 때 함께 자동 입력(빈 문자열 = 미설정)
}

export const DEFAULT_ACCOUNT_RULES: AccountRuleEntry[] = [
  { division: '매출', bizNo: '198-20-01018', vendorName: '컬렉션오브', itemPattern: '사무실 임대료', accountName: '임대료수익', siteCode: null, note: '', project: '', paymentBasisAccount: '' },
  { division: '매출', bizNo: '617-81-00049', vendorName: '고려제강 주식회사', itemPattern: '태양광발전시스템 유지운영관리', accountName: '제품매출', siteCode: null, note: '', project: '', paymentBasisAccount: '' },
  { division: '매출', bizNo: '305-81-70225', vendorName: '주식회사 시스웍', itemPattern: '왕정발전1호 태양광발전시설 관리운영비', accountName: '제품매출', siteCode: null, note: '', project: '', paymentBasisAccount: '' },
  { division: '매출', bizNo: '151-14-01167', vendorName: '미래준2 태양광발전소', itemPattern: '미래준2 관리운영비', accountName: '제품매출', siteCode: null, note: '', project: '', paymentBasisAccount: '' },
  { division: '매출', bizNo: '206-48-62571', vendorName: '미래준1 태양광발전소', itemPattern: '미래준1 관리운영비', accountName: '제품매출', siteCode: null, note: '', project: '', paymentBasisAccount: '' },
  { division: '매출', bizNo: '671-18-00694', vendorName: '무지기 태양광발전소', itemPattern: '무지기 태양광발전시설 관리운영비', accountName: '제품매출', siteCode: null, note: '', project: '', paymentBasisAccount: '' },
  { division: '매출', bizNo: '506-81-13147', vendorName: '키스트론 주식회사', itemPattern: '관리운영위탁수수료', accountName: '제품매출', siteCode: null, note: '', project: '', paymentBasisAccount: '' },
  { division: '매출', bizNo: '120-82-05834', vendorName: '한국전력거래소', itemPattern: '전력거래대금', accountName: '태양광매출', siteCode: null, note: '', project: '', paymentBasisAccount: '' },
  { division: '매출', bizNo: '120-82-05834', vendorName: '한국전력거래소', itemPattern: 'REC 거래금', accountName: '태양광매출', siteCode: null, note: '', project: '', paymentBasisAccount: '' },
  { division: '매출', bizNo: '120-82-00052', vendorName: '한국전력공사', itemPattern: '전력거래분', accountName: '태양광매출', siteCode: null, note: '', project: '', paymentBasisAccount: '' },
  { division: '매출', bizNo: '120-86-19165', vendorName: '한국남부발전주식회사', itemPattern: 'REC', accountName: '태양광매출', siteCode: null, note: '', project: '', paymentBasisAccount: '' },
]
