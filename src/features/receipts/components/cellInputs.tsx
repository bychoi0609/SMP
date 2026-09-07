// 표 안에서 바로 값을 고치는 인라인 편집 입력들. 클릭해서 바로 수정하고
// 바뀐 값은 즉시(onChange) 반영된다 — 별도의 "편집 모드 진입" 단계를 두지 않는다.

import { useState } from 'react'
import { handleInlineAutocompleteChange } from '../lib/inlineAutocomplete'

interface TextCellProps {
  value: string
  onChange: (value: string) => void
  listId?: string
  placeholder?: string
  align?: 'left' | 'center' | 'right'
}

export function TextCell({ value, onChange, listId, placeholder, align }: TextCellProps) {
  return (
    <input
      type="text"
      className="cell-input"
      style={align ? { textAlign: align } : undefined}
      value={value}
      list={listId}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

interface AccountCodeCellProps {
  value: string
  onChange: (value: string) => void
  options: string[]
  align?: 'left' | 'center' | 'right'
}

// 계정과목 입력 — 드롭다운 없이, 엑셀처럼 입력한 접두사와 일치하는 이전 계정과목을 자동으로 이어 채운다.
export function AccountCodeCell({ value, onChange, options, align }: AccountCodeCellProps) {
  return (
    <input
      type="text"
      className="cell-input"
      style={align ? { textAlign: align } : undefined}
      value={value}
      onChange={(e) => handleInlineAutocompleteChange(e, options, onChange)}
    />
  )
}

interface NumberCellProps {
  value: number
  onChange: (value: number) => void
}

export function NumberCell({ value, onChange }: NumberCellProps) {
  return (
    <input
      type="number"
      className="cell-input cell-input--number"
      value={Number.isNaN(value) ? '' : value}
      onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
    />
  )
}

interface CurrencyCellProps {
  value: number
  onChange: (value: number) => void
}

// 금액(합계금액/공급가액/세액) 입력용 — 편집 중이 아닐 때는 1000단위 구분 기호(,)를 붙여 보여준다.
export function CurrencyCell({ value, onChange }: CurrencyCellProps) {
  const [focused, setFocused] = useState(false)
  const display = focused ? String(Number.isNaN(value) ? '' : value) : value.toLocaleString('ko-KR')

  return (
    <input
      type="text"
      inputMode="numeric"
      className="cell-input cell-input--currency"
      value={display}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        const digits = e.target.value.replace(/[^0-9-]/g, '')
        onChange(digits === '' || digits === '-' ? 0 : Number(digits))
      }}
    />
  )
}

interface OptionalNumberCellProps {
  value: number | null
  onChange: (value: number | null) => void
  align?: 'left' | 'center' | 'right'
}

export function OptionalNumberCell({ value, onChange, align }: OptionalNumberCellProps) {
  return (
    <input
      type="text"
      inputMode="numeric"
      className="cell-input cell-input--number"
      style={align ? { textAlign: align } : undefined}
      value={value ?? ''}
      onChange={(e) => {
        const digits = e.target.value.replace(/[^0-9]/g, '')
        onChange(digits === '' ? null : Number(digits))
      }}
    />
  )
}

interface DateCellProps {
  value: string
  onChange: (value: string) => void
  highlight?: boolean
  title?: string
}

export function DateCell({ value, onChange, highlight, title }: DateCellProps) {
  return (
    <input
      type="date"
      className={`cell-input${highlight ? ' cell-input--highlight' : ''}`}
      value={value}
      title={title}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

interface SelectCellProps {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  align?: 'left' | 'center' | 'right'
}

export function SelectCell({ value, onChange, options, align }: SelectCellProps) {
  return (
    <select
      className="cell-input"
      style={align ? { textAlign: align } : undefined}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}
