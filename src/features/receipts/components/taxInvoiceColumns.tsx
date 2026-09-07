import type { Column } from './Table'
import type { TaxInvoiceDirection, TaxInvoiceRow } from '../types/tables'
import { AccountCodeCell, CurrencyCell, DateCell, OptionalNumberCell, SelectCell, TextCell } from './cellInputs'

interface TaxInvoiceColumnOptions {
  onChange: (rowIndex: number, patch: Partial<TaxInvoiceRow>) => void
  counterpartyNameListId: string
  accountCodeOptions: string[]
  accountCodeMinWidth?: number
  paymentBasisOptions: string[]
  direction: TaxInvoiceDirection
}

// 매출 세금계산서에는 필요 없는 컬럼(구분번호/비고/세부내역)이라 매출 표에서만 뺀다.
const SALES_HIDDEN_COLUMN_KEYS = ['siteCode', 'note', 'detail']

const ISSUE_TYPE_OPTIONS = [
  { value: '전자', label: '전자' },
  { value: '종이', label: '종이' },
]
const TAX_TYPE_OPTIONS = [
  { value: '과세', label: '과세' },
  { value: '불공', label: '불공' },
]

// PRD 7.1.1 출력 양식 컬럼 순서 그대로, 각 셀은 인라인 편집 가능.
export function createTaxInvoiceColumns({
  onChange,
  counterpartyNameListId,
  accountCodeOptions,
  accountCodeMinWidth = 110,
  paymentBasisOptions,
  direction,
}: TaxInvoiceColumnOptions): Column<TaxInvoiceRow>[] {
  const columns: Column<TaxInvoiceRow>[] = [
    { key: 'no', label: '번호', align: 'center', render: (r) => r.no, sortValue: (r) => r.no },
    {
      key: 'writtenDate',
      label: '작성일자',
      align: 'center',
      render: (r, i) => <DateCell value={r.writtenDate} onChange={(v) => onChange(i, { writtenDate: v })} />,
      sortValue: (r) => r.writtenDate,
    },
    {
      key: 'counterpartyBizNo',
      label: (
        <>
          공급자
          <br />
          사업자등록번호
        </>
      ),
      align: 'center',
      minWidth: 120,
      render: (r, i) => (
        <TextCell value={r.counterpartyBizNo} onChange={(v) => onChange(i, { counterpartyBizNo: v })} align="center" />
      ),
    },
    {
      key: 'counterpartyName',
      label: '상호',
      minWidth: 180,
      render: (r, i) => (
        <TextCell
          value={r.counterpartyName}
          onChange={(v) => onChange(i, { counterpartyName: v })}
          listId={counterpartyNameListId}
        />
      ),
      sortValue: (r) => r.counterpartyName,
      searchValue: (r) => r.counterpartyName,
      searchLabel: '거래처명',
    },
    {
      key: 'totalAmount',
      label: '합계금액',
      align: 'center',
      minWidth: 110,
      render: (r, i) => <CurrencyCell value={r.totalAmount} onChange={(v) => onChange(i, { totalAmount: v })} />,
      sortValue: (r) => r.totalAmount,
    },
    {
      key: 'supplyAmount',
      label: '공급가액',
      align: 'center',
      minWidth: 110,
      render: (r, i) => <CurrencyCell value={r.supplyAmount} onChange={(v) => onChange(i, { supplyAmount: v })} />,
    },
    {
      key: 'taxAmount',
      label: '세액',
      align: 'center',
      minWidth: 100,
      render: (r, i) => <CurrencyCell value={r.taxAmount} onChange={(v) => onChange(i, { taxAmount: v })} />,
    },
    {
      key: 'itemName',
      label: '품목명',
      minWidth: 180,
      render: (r, i) => <TextCell value={r.itemName} onChange={(v) => onChange(i, { itemName: v })} />,
      searchValue: (r) => r.itemName,
      searchLabel: '품목명',
    },
    {
      key: 'issueType',
      label: '유형1',
      minWidth: 85,
      render: (r, i) => (
        <SelectCell
          value={r.issueType}
          options={ISSUE_TYPE_OPTIONS}
          onChange={(v) => onChange(i, { issueType: v as TaxInvoiceRow['issueType'] })}
        />
      ),
    },
    {
      key: 'taxType',
      label: '유형2',
      minWidth: 85,
      render: (r, i) => (
        <SelectCell
          value={r.taxType}
          options={TAX_TYPE_OPTIONS}
          onChange={(v) => onChange(i, { taxType: v as TaxInvoiceRow['taxType'] })}
        />
      ),
    },
    {
      key: 'accountCode',
      label: '계정과목',
      minWidth: accountCodeMinWidth,
      align: 'center',
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
      render: (r, i) => (
        <OptionalNumberCell value={r.siteCode} onChange={(v) => onChange(i, { siteCode: v })} align="center" />
      ),
    },
    {
      key: 'paymentBasisAccount',
      label: '대금기준',
      minWidth: 120,
      align: 'center',
      render: (r, i) => (
        <AccountCodeCell
          value={r.paymentBasisAccount}
          onChange={(v) => onChange(i, { paymentBasisAccount: v })}
          options={paymentBasisOptions}
          align="center"
        />
      ),
    },
    {
      key: 'paymentDate',
      label: '결제일',
      render: (r, i) => (
        <DateCell
          value={r.paymentDate}
          onChange={(v) => onChange(i, { paymentDate: v, paymentMatchStatus: undefined, paymentMatchNote: undefined })}
          highlight={r.paymentMatchStatus === 'ambiguous'}
          title={r.paymentMatchNote}
        />
      ),
    },
    {
      key: 'note',
      label: '비고',
      render: (r, i) => <TextCell value={r.note} onChange={(v) => onChange(i, { note: v })} />,
    },
    {
      key: 'project',
      label: '프로젝트',
      render: (r, i) => <TextCell value={r.project} onChange={(v) => onChange(i, { project: v })} />,
    },
    {
      key: 'detail',
      label: '세부내역',
      align: 'center',
      render: (r, i) => <TextCell value={r.detail} onChange={(v) => onChange(i, { detail: v })} align="center" />,
    },
  ]

  return direction === 'sales' ? columns.filter((c) => !SALES_HIDDEN_COLUMN_KEYS.includes(c.key)) : columns
}
