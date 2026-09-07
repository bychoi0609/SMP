import * as XLSX from 'xlsx'
import type { AccountRuleDivision, AccountRuleEntry } from '../data/accountRules'
import { accountRuleKey } from './accountRules'

// 대량 등록용 엑셀 양식의 헤더 — downloadAccountRuleTemplate()이 만드는 파일과 parseAccountRuleRows()가
// 읽는 파일이 항상 같은 순서/이름을 쓰도록 한 곳에서 정의한다.
const TEMPLATE_COLUMNS: { label: string; key: keyof AccountRuleEntry }[] = [
  { label: '구분', key: 'division' },
  { label: '사업자등록번호', key: 'bizNo' },
  { label: '상호', key: 'vendorName' },
  { label: '품목명 패턴', key: 'itemPattern' },
  { label: '계정과목', key: 'accountName' },
  { label: '구분번호', key: 'siteCode' },
  { label: '비고', key: 'note' },
  { label: '프로젝트', key: 'project' },
  { label: '대금기준', key: 'paymentBasisAccount' },
]

const DIVISION_VALUES: AccountRuleDivision[] = ['매출', '매입', '영수증']

export function downloadAccountRuleTemplate(): void {
  const header = TEMPLATE_COLUMNS.map((c) => c.label)
  const example = [
    ['매출', '120-82-05834', '한국전력거래소', '전력거래대금', '태양광매출', '8', '', '태양광1호', '보통예금'],
    ['매입', '617-81-00049', '고려제강 주식회사', '', '수수료', '7', '세금계산서 확인', '', '미지급금'],
    ['영수증', '', '스타벅스', '', '복리후생비', '', '', '', ''],
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([header, ...example]), '계정과목규칙')
  XLSX.writeFile(wb, '계정과목_규칙_양식.xlsx')
}

export type AccountRuleImportStatus = 'ok' | 'duplicate' | 'error'

export interface ParsedAccountRuleRow {
  rowNumber: number // 엑셀상 행 번호(1행=헤더) — 사용자가 원본 파일에서 찾기 쉽도록 그대로 노출
  entry: AccountRuleEntry
  status: AccountRuleImportStatus
  message: string
}

export interface ParseAccountRuleRowsResult {
  parsed: ParsedAccountRuleRow[]
  headerError: string | null
}

// 대량 등록 엑셀(rows: 헤더+데이터)을 읽어 행별 검증 결과를 만든다.
// existingRules와 매칭 조건이 같은 행은 'duplicate', 필수값이 비었거나 구분 값이 잘못되면 'error'로 표시한다.
export function parseAccountRuleRows(
  rows: string[][],
  existingRules: AccountRuleEntry[],
): ParseAccountRuleRowsResult {
  if (rows.length === 0) {
    return { parsed: [], headerError: '파일에 데이터가 없습니다.' }
  }

  const header = rows[0].map((cell) => String(cell ?? '').trim())
  const colIndex: Partial<Record<keyof AccountRuleEntry, number>> = {}
  header.forEach((label, i) => {
    const col = TEMPLATE_COLUMNS.find((c) => c.label === label)
    if (col) colIndex[col.key] = i
  })
  const missingLabels = TEMPLATE_COLUMNS.filter((c) => colIndex[c.key] === undefined).map((c) => c.label)
  if (missingLabels.length > 0) {
    return {
      parsed: [],
      headerError: `엑셀 양식과 일치하지 않습니다. 다음 헤더가 없습니다: ${missingLabels.join(', ')}. "엑셀 양식 다운로드"로 받은 양식을 사용해주세요.`,
    }
  }

  const seenKeys = new Set(
    existingRules.map(accountRuleKey).filter((key): key is string => key !== null),
  )
  const parsed: ParsedAccountRuleRow[] = []

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] ?? []
    if (row.every((cell) => String(cell ?? '').trim() === '')) continue // 빈 행 무시

    const get = (key: keyof AccountRuleEntry) => String(row[colIndex[key]!] ?? '').trim()
    const rowNumber = i + 1
    const divisionRaw = get('division')
    const siteCodeRaw = get('siteCode')
    const siteCode = siteCodeRaw === '' ? null : Number(siteCodeRaw)
    const entry: AccountRuleEntry = {
      division: (DIVISION_VALUES.includes(divisionRaw as AccountRuleDivision) ? divisionRaw : '매출') as AccountRuleDivision,
      bizNo: get('bizNo'),
      vendorName: get('vendorName'),
      itemPattern: get('itemPattern'),
      accountName: get('accountName'),
      siteCode: siteCode === null || Number.isNaN(siteCode) ? null : siteCode,
      note: get('note'),
      project: get('project'),
      paymentBasisAccount: get('paymentBasisAccount'),
    }

    if (!DIVISION_VALUES.includes(divisionRaw as AccountRuleDivision)) {
      parsed.push({
        rowNumber,
        entry,
        status: 'error',
        message: `구분 값이 올바르지 않습니다("매출"/"매입"/"영수증" 중 하나여야 함): "${divisionRaw}"`,
      })
      continue
    }
    if (!entry.accountName) {
      parsed.push({ rowNumber, entry, status: 'error', message: '계정과목이 비어 있습니다.' })
      continue
    }
    if (siteCodeRaw !== '' && Number.isNaN(siteCode)) {
      parsed.push({ rowNumber, entry, status: 'error', message: '구분번호는 숫자여야 합니다.' })
      continue
    }
    if (entry.division === '영수증') {
      if (!entry.vendorName) {
        parsed.push({ rowNumber, entry, status: 'error', message: '영수증 규칙은 상호(가맹점명)가 필요합니다.' })
        continue
      }
    } else if (!entry.bizNo) {
      parsed.push({ rowNumber, entry, status: 'error', message: `${entry.division} 규칙은 사업자등록번호가 필요합니다.` })
      continue
    }

    const key = accountRuleKey(entry)
    if (key && seenKeys.has(key)) {
      parsed.push({ rowNumber, entry, status: 'duplicate', message: '이미 등록된 규칙과 매칭 조건이 같습니다.' })
      continue
    }
    if (key) seenKeys.add(key)
    parsed.push({ rowNumber, entry, status: 'ok', message: '' })
  }

  return { parsed, headerError: null }
}
