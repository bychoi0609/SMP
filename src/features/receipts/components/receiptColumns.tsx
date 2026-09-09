import type { Column } from './Table'
import type { ReceiptRow } from '../types/tables'
import { AccountCodeCell, CurrencyCell, DateCell, OptionalNumberCell, TextCell } from './cellInputs'
import { formatNumber } from '../lib/format'

interface ReceiptColumnOptions {
  onChange?: (rowIndex: number, patch: Partial<ReceiptRow>) => void
  merchantNameListId?: string
  accountCodeOptions?: string[]
  detailOptions?: string[]
  // true면 셀을 입력창이 아닌 텍스트로만 보여준다("월별 영수증 데이터" 보기 화면 전용).
  readOnly?: boolean
  // 카드별 화면처럼 확정된 달과 안 된 달이 한 화면에 섞여 있을 때, 행(rowIndex) 단위로 확정(잠금)
  // 여부를 판단한다. true를 반환한 행은 readOnly와 동일하게 텍스트로만 보여준다.
  isRowLocked?: (rowIndex: number) => boolean
}

// PRD 7.2.1 출력 양식 컬럼 순서 그대로, 각 셀은 인라인 편집 가능(readOnly면 텍스트만 표시).
export function createReceiptColumns({
  onChange,
  merchantNameListId,
  accountCodeOptions = [],
  detailOptions = [],
  readOnly = false,
  isRowLocked,
}: ReceiptColumnOptions): Column<ReceiptRow>[] {
  return [
    {
      key: 'date',
      label: '날짜',
      render: (r, i) =>
        readOnly || isRowLocked?.(i) ? r.date : <DateCell value={r.date} onChange={(v) => onChange!(i, { date: v })} />,
      sortValue: (r) => r.date,
    },
    {
      key: 'merchantName',
      label: '거래처명',
      minWidth: 150,
      render: (r, i) =>
        readOnly || isRowLocked?.(i) ? (
          r.merchantName
        ) : (
          <TextCell
            value={r.merchantName}
            onChange={(v) => onChange!(i, { merchantName: v })}
            listId={merchantNameListId}
          />
        ),
      sortValue: (r) => r.merchantName,
      searchValue: (r) => r.merchantName,
      searchLabel: '거래처명',
    },
    {
      key: 'supplyAmount',
      label: '공급가액',
      align: 'center',
      minWidth: 100,
      render: (r, i) =>
        readOnly || isRowLocked?.(i) ? (
          formatNumber(r.supplyAmount)
        ) : (
          <CurrencyCell value={r.supplyAmount} onChange={(v) => onChange!(i, { supplyAmount: v })} />
        ),
    },
    {
      key: 'taxAmount',
      label: '세액',
      align: 'center',
      minWidth: 90,
      render: (r, i) =>
        readOnly || isRowLocked?.(i) ? (
          formatNumber(r.taxAmount)
        ) : (
          <CurrencyCell value={r.taxAmount} onChange={(v) => onChange!(i, { taxAmount: v })} />
        ),
    },
    {
      key: 'totalAmount',
      label: '합계',
      align: 'center',
      minWidth: 100,
      render: (r, i) =>
        readOnly || isRowLocked?.(i) ? (
          formatNumber(r.totalAmount)
        ) : (
          <CurrencyCell value={r.totalAmount} onChange={(v) => onChange!(i, { totalAmount: v })} />
        ),
      sortValue: (r) => r.totalAmount,
    },
    {
      key: 'siteName',
      label: '현장명',
      align: 'center',
      minWidth: 90,
      render: (r, i) =>
        readOnly || isRowLocked?.(i) ? (
          r.siteName
        ) : (
          <TextCell value={r.siteName} onChange={(v) => onChange!(i, { siteName: v })} align="center" />
        ),
      searchValue: (r) => r.siteName,
      searchLabel: '현장명',
    },
    {
      key: 'description',
      label: '내역',
      align: 'center',
      minWidth: 90,
      render: (r, i) =>
        readOnly || isRowLocked?.(i) ? (
          r.description
        ) : (
          <TextCell value={r.description} onChange={(v) => onChange!(i, { description: v })} align="center" />
        ),
    },
    {
      key: 'accountCode',
      label: '계정과목',
      align: 'center',
      minWidth: 110,
      render: (r, i) =>
        readOnly || isRowLocked?.(i) ? (
          r.accountCode
        ) : (
          <AccountCodeCell
            value={r.accountCode}
            onChange={(v) => onChange!(i, { accountCode: v })}
            options={accountCodeOptions}
            align="center"
          />
        ),
      searchValue: (r) => r.accountCode,
      searchLabel: '계정과목',
    },
    {
      key: 'siteCode',
      label: '구분',
      align: 'center',
      minWidth: 40,
      render: (r, i) =>
        readOnly || isRowLocked?.(i) ? (
          (r.siteCode ?? '')
        ) : (
          <OptionalNumberCell value={r.siteCode} onChange={(v) => onChange!(i, { siteCode: v })} align="center" />
        ),
    },
    {
      key: 'taxType',
      label: '과세유형',
      align: 'center',
      render: (r, i) =>
        readOnly || isRowLocked?.(i) ? (
          r.taxType
        ) : (
          <TextCell value={r.taxType} onChange={(v) => onChange!(i, { taxType: v })} align="center" />
        ),
    },
    {
      key: 'detail',
      label: '세부내역',
      align: 'center',
      render: (r, i) =>
        readOnly || isRowLocked?.(i) ? (
          r.detail
        ) : (
          <AccountCodeCell
            value={r.detail}
            onChange={(v) => onChange!(i, { detail: v })}
            options={detailOptions}
            align="center"
          />
        ),
    },
  ]
}
