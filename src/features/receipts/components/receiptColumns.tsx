import type { Column } from './Table'
import type { ReceiptRow } from '../types/tables'
import { AccountCodeCell, CurrencyCell, DateCell, OptionalNumberCell, TextCell } from './cellInputs'

interface ReceiptColumnOptions {
  onChange: (rowIndex: number, patch: Partial<ReceiptRow>) => void
  merchantNameListId: string
  accountCodeOptions: string[]
  detailOptions: string[]
}

// PRD 7.2.1 출력 양식 컬럼 순서 그대로, 각 셀은 인라인 편집 가능.
export function createReceiptColumns({
  onChange,
  merchantNameListId,
  accountCodeOptions,
  detailOptions,
}: ReceiptColumnOptions): Column<ReceiptRow>[] {
  return [
    {
      key: 'date',
      label: '날짜',
      render: (r, i) => <DateCell value={r.date} onChange={(v) => onChange(i, { date: v })} />,
      sortValue: (r) => r.date,
    },
    {
      key: 'merchantName',
      label: '거래처명',
      minWidth: 180,
      render: (r, i) => (
        <TextCell
          value={r.merchantName}
          onChange={(v) => onChange(i, { merchantName: v })}
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
      render: (r, i) => <CurrencyCell value={r.supplyAmount} onChange={(v) => onChange(i, { supplyAmount: v })} />,
    },
    {
      key: 'taxAmount',
      label: '세액',
      align: 'center',
      minWidth: 90,
      render: (r, i) => <CurrencyCell value={r.taxAmount} onChange={(v) => onChange(i, { taxAmount: v })} />,
    },
    {
      key: 'totalAmount',
      label: '합계',
      align: 'center',
      minWidth: 100,
      render: (r, i) => <CurrencyCell value={r.totalAmount} onChange={(v) => onChange(i, { totalAmount: v })} />,
      sortValue: (r) => r.totalAmount,
    },
    {
      key: 'accountCode',
      label: '계정과목',
      align: 'center',
      minWidth: 120,
      render: (r, i) => (
        <AccountCodeCell
          value={r.accountCode}
          onChange={(v) => onChange(i, { accountCode: v })}
          options={accountCodeOptions}
          align="center"
        />
      ),
      searchValue: (r) => r.accountCode,
      searchLabel: '계정과목',
    },
    {
      key: 'siteCode',
      label: '구분번호',
      align: 'center',
      minWidth: 50,
      render: (r, i) => (
        <OptionalNumberCell value={r.siteCode} onChange={(v) => onChange(i, { siteCode: v })} align="center" />
      ),
    },
    {
      key: 'taxType',
      label: '과세유형',
      render: (r, i) => <TextCell value={r.taxType} onChange={(v) => onChange(i, { taxType: v })} />,
    },
    {
      key: 'detail',
      label: '세부내역',
      align: 'center',
      render: (r, i) => (
        <AccountCodeCell
          value={r.detail}
          onChange={(v) => onChange(i, { detail: v })}
          options={detailOptions}
          align="center"
        />
      ),
    },
  ]
}
