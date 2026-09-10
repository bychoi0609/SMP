import type { Column } from './Table'
import type { TaxInvoiceDirection, TaxInvoiceRow } from '../types/tables'
import { AccountCodeCell, CurrencyCell, DateCell, OptionalNumberCell, SelectCell, TextCell } from './cellInputs'
import { formatNumber } from '../lib/format'

interface TaxInvoiceColumnOptions {
  onChange?: (rowIndex: number, patch: Partial<TaxInvoiceRow>) => void
  counterpartyNameListId?: string
  accountCodeOptions?: string[]
  accountCodeWidth?: number
  paymentBasisOptions?: string[]
  direction: TaxInvoiceDirection
  // true면 셀을 입력창이 아닌 텍스트로만 보여준다("월별 세금계산서 데이터" 보기 화면 전용).
  readOnly?: boolean
  // 정리 화면의 "전체" 탭처럼 확정된 달과 안 된 달이 한 화면에 섞여 있을 때, 행(rowIndex) 단위로
  // 확정(잠금) 여부를 판단한다. true를 반환한 행은 readOnly와 동일하게 텍스트로만 보여준다.
  isRowLocked?: (rowIndex: number) => boolean
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

// PRD 7.1.1 출력 양식 컬럼 순서 그대로, 각 셀은 인라인 편집 가능(readOnly면 텍스트만 표시).
export function createTaxInvoiceColumns({
  onChange,
  counterpartyNameListId,
  accountCodeOptions = [],
  accountCodeWidth = 110,
  paymentBasisOptions = [],
  direction,
  readOnly = false,
  isRowLocked,
}: TaxInvoiceColumnOptions): Column<TaxInvoiceRow>[] {
  const columns: Column<TaxInvoiceRow>[] = [
    { key: 'no', label: '번호', align: 'center', width: 56, render: (r) => r.no, sortValue: (r) => r.no },
    {
      key: 'writtenDate',
      label: '작성일자',
      align: 'center',
      width: 104,
      render: (r, i) =>
        readOnly || isRowLocked?.(i) ? (
          r.writtenDate
        ) : (
          <DateCell value={r.writtenDate} onChange={(v) => onChange!(i, { writtenDate: v })} />
        ),
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
      width: 130,
      render: (r, i) =>
        readOnly || isRowLocked?.(i) ? (
          r.counterpartyBizNo
        ) : (
          <TextCell
            value={r.counterpartyBizNo}
            onChange={(v) => onChange!(i, { counterpartyBizNo: v })}
            align="center"
          />
        ),
    },
    {
      key: 'counterpartyName',
      label: '상호',
      width: 180,
      render: (r, i) =>
        readOnly || isRowLocked?.(i) ? (
          r.counterpartyName
        ) : (
          <TextCell
            value={r.counterpartyName}
            onChange={(v) => onChange!(i, { counterpartyName: v })}
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
      width: 110,
      render: (r, i) =>
        readOnly || isRowLocked?.(i) ? (
          formatNumber(r.totalAmount)
        ) : (
          <CurrencyCell value={r.totalAmount} onChange={(v) => onChange!(i, { totalAmount: v })} />
        ),
      sortValue: (r) => r.totalAmount,
    },
    {
      key: 'supplyAmount',
      label: '공급가액',
      align: 'center',
      width: 110,
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
      width: 100,
      render: (r, i) =>
        readOnly || isRowLocked?.(i) ? (
          formatNumber(r.taxAmount)
        ) : (
          <CurrencyCell value={r.taxAmount} onChange={(v) => onChange!(i, { taxAmount: v })} />
        ),
    },
    {
      key: 'itemName',
      label: '품목명',
      width: 180,
      render: (r, i) =>
        readOnly || isRowLocked?.(i) ? r.itemName : <TextCell value={r.itemName} onChange={(v) => onChange!(i, { itemName: v })} />,
      searchValue: (r) => r.itemName,
      searchLabel: '품목명',
    },
    {
      key: 'issueType',
      label: '유형1',
      width: 85,
      render: (r, i) =>
        readOnly || isRowLocked?.(i) ? (
          r.issueType
        ) : (
          <SelectCell
            value={r.issueType}
            options={ISSUE_TYPE_OPTIONS}
            onChange={(v) => onChange!(i, { issueType: v as TaxInvoiceRow['issueType'] })}
          />
        ),
    },
    {
      key: 'taxType',
      label: '유형2',
      width: 85,
      render: (r, i) =>
        readOnly || isRowLocked?.(i) ? (
          r.taxType
        ) : (
          <SelectCell
            value={r.taxType}
            options={TAX_TYPE_OPTIONS}
            onChange={(v) => onChange!(i, { taxType: v as TaxInvoiceRow['taxType'] })}
          />
        ),
    },
    {
      key: 'accountCode',
      label: '계정과목',
      width: accountCodeWidth,
      align: 'center',
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
      label: '구분번호',
      align: 'center',
      width: 90,
      render: (r, i) =>
        readOnly || isRowLocked?.(i) ? (
          (r.siteCode ?? '')
        ) : (
          <OptionalNumberCell value={r.siteCode} onChange={(v) => onChange!(i, { siteCode: v })} align="center" />
        ),
    },
    {
      key: 'paymentBasisAccount',
      label: '대금기준',
      width: 120,
      align: 'center',
      render: (r, i) =>
        readOnly || isRowLocked?.(i) ? (
          r.paymentBasisAccount
        ) : (
          <AccountCodeCell
            value={r.paymentBasisAccount}
            onChange={(v) => onChange!(i, { paymentBasisAccount: v })}
            options={paymentBasisOptions}
            align="center"
          />
        ),
    },
    {
      key: 'paymentDate',
      label: '결제일',
      width: 104,
      render: (r, i) =>
        readOnly || isRowLocked?.(i) ? (
          r.paymentDate
        ) : (
          <DateCell
            value={r.paymentDate}
            onChange={(v) =>
              onChange!(i, { paymentDate: v, paymentMatchStatus: undefined, paymentMatchNote: undefined })
            }
            highlight={r.paymentMatchStatus === 'ambiguous'}
            title={r.paymentMatchNote}
          />
        ),
    },
    {
      key: 'note',
      label: '비고',
      width: 140,
      render: (r, i) =>
        readOnly || isRowLocked?.(i) ? r.note : <TextCell value={r.note} onChange={(v) => onChange!(i, { note: v })} />,
    },
    {
      key: 'project',
      label: '프로젝트',
      width: 110,
      render: (r, i) =>
        readOnly || isRowLocked?.(i) ? r.project : <TextCell value={r.project} onChange={(v) => onChange!(i, { project: v })} />,
    },
    {
      key: 'detail',
      label: '세부내역',
      align: 'center',
      width: 130,
      render: (r, i) =>
        readOnly || isRowLocked?.(i) ? (
          r.detail
        ) : (
          <TextCell value={r.detail} onChange={(v) => onChange!(i, { detail: v })} align="center" />
        ),
      searchValue: (r) => r.detail,
      searchLabel: '세부내역',
    },
  ]

  return direction === 'sales' ? columns.filter((c) => !SALES_HIDDEN_COLUMN_KEYS.includes(c.key)) : columns
}
