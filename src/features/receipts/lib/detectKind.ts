export type FileKind = 'taxInvoice' | 'receipt' | 'bankTransaction' | 'unknown'

export interface DetectedSheet {
  kind: FileKind
  headerRowIndex: number // 'unknown'이면 -1
}

// 실제 홈택스/카드사/은행 샘플 파일의 헤더 행을 기준으로 한 시그니처 컬럼.
// (samples/ 파일에서 직접 확인한 실제 헤더 문자열 — PRD의 발췌 목록이 아님)
function isTaxInvoiceHeader(row: string[]): boolean {
  return (
    row[0] === '작성일자' &&
    row[1] === '승인번호' &&
    row[4] === '공급자사업자등록번호' &&
    row[9] === '공급받는자사업자등록번호' &&
    row[26] === '품목명'
  )
}

function isReceiptHeader(row: string[]): boolean {
  return row[0] === '순번' && row[1] === '카드번호' && row[4] === '가맹점명'
}

function isBankTransactionHeader(row: string[]): boolean {
  return (
    row.includes('거래일시') &&
    row.includes('출금') &&
    row.includes('입금') &&
    row.includes('거래내용')
  )
}

export function detectSheetKind(rows: string[][]): DetectedSheet {
  const scanLimit = Math.min(rows.length, 10)
  for (let i = 0; i < scanLimit; i++) {
    const row = rows[i]
    if (!row || row.length === 0) continue
    if (isTaxInvoiceHeader(row)) return { kind: 'taxInvoice', headerRowIndex: i }
    if (isReceiptHeader(row)) return { kind: 'receipt', headerRowIndex: i }
    if (isBankTransactionHeader(row)) return { kind: 'bankTransaction', headerRowIndex: i }
  }
  return { kind: 'unknown', headerRowIndex: -1 }
}
