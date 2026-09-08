export type TaxInvoiceDirection = 'sales' | 'purchase'

// PRD 7.1.1 출력(다운로드) 양식
export interface TaxInvoiceRow {
  no: number
  writtenDate: string // 작성일자 (YYYY-MM-DD)
  counterpartyBizNo: string // 공급자 사업자등록번호 (=거래처 사업자번호)
  counterpartyName: string // 상호 (=거래처명)
  totalAmount: number // 합계금액
  supplyAmount: number // 공급가액
  taxAmount: number // 세액
  itemName: string // 품목명
  issueType: '전자' | '종이' // 유형1
  taxType: '과세' | '불공' // 유형2
  accountCode: string // 계정과목
  siteCode: number | null // 구분번호
  paymentBasisAccount: string // 대금기준 — 계정과목처럼 엑셀식 자동완성 입력(값 제한 없음, 빈 문자열 = 미입력)
  paymentDate: string // 결제일 (FR-4에서 채움)
  note: string // 비고
  project: string // 프로젝트
  detail: string // 세부내역
  // FR-4 통장내역 매칭 상태 — 다운로드 출력 컬럼이 아닌 화면 표시 전용 메타데이터.
  paymentMatchStatus?: 'ambiguous'
  paymentMatchNote?: string
  // 승인번호 — 홈택스 원본에만 있는 문서당 고유값. 다운로드 출력 컬럼이 아닌, 월별 누적 업로드 시
  // 중복 판단(병합)을 위한 내부 전용 필드.
  approvalNo?: string
}

// PRD 7.2.1 출력(다운로드) 양식
export interface ReceiptRow {
  date: string // 날짜 (YYYY-MM-DD)
  merchantName: string // 거래처명
  supplyAmount: number // 공급가액
  taxAmount: number // 세액
  totalAmount: number // 합계
  siteName: string // 현장명
  description: string // 내역
  accountCode: string // 계정과목
  siteCode: number | null // 구분 (구 "구분번호")
  taxType: '일반' | '불공' | string // 과세유형 (원본 값 그대로)
  detail: string // 세부내역
}

export const SITE_CODE_DETAIL_MAP: Record<number, string> = {
  6: '공사',
  7: '제조',
  8: 'SC본사',
}
