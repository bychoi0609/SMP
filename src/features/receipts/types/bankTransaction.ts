// PRD 7.3 통장내역 (입력 전용, 다운로드 결과물에는 포함되지 않음)
export interface BankTransaction {
  dateOnly: string // 거래일시 중 날짜 부분 (YYYY-MM-DD)
  withdrawal: number // 출금 (0이면 입금 거래)
  deposit: number // 입금 (0이면 출금 거래)
  description: string // 거래내용 (거래처명 매칭 1순위)
  counterpartyAccountHolder: string // 상대계좌예금주명 (거래처명 매칭 2순위)
}
