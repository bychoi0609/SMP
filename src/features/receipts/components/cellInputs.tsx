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

// 숫자만 입력해도(YYMMDD 6자리 또는 YYYYMMDD 8자리) "YYYY-MM-DD"로 정규화한다.
// 두 자리 연도는 20xx년으로 해석한다 — 대시(-)를 섞어 써도 숫자만 추려 같은 방식으로 처리한다.
function normalizeTypedDate(input: string): string | null {
  const digits = input.replace(/\D/g, '')
  let year: number
  let month: number
  let day: number
  if (digits.length === 6) {
    year = 2000 + Number(digits.slice(0, 2))
    month = Number(digits.slice(2, 4))
    day = Number(digits.slice(4, 6))
  } else if (digits.length === 8) {
    year = Number(digits.slice(0, 4))
    month = Number(digits.slice(4, 6))
    day = Number(digits.slice(6, 8))
  } else {
    return null
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// 네이티브 <input type="date">는 브라우저별 세그먼트 입력 방식 때문에 연도 4자리를 다 채우기 전까지
// 월/일 칸이 밀리는 등 숫자를 연속 타이핑하기 불편해 텍스트 입력 + 자동 정규화 방식으로 대체한다.
export function DateCell({ value, onChange, highlight, title }: DateCellProps) {
  const [draft, setDraft] = useState<string | null>(null)

  return (
    <input
      type="text"
      inputMode="numeric"
      placeholder="YYYY-MM-DD"
      className={`cell-input${highlight ? ' cell-input--highlight' : ''}`}
      value={draft ?? value}
      title={title}
      onFocus={() => setDraft(value)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={(e) => {
        const raw = e.target.value.trim()
        if (raw === '') {
          onChange('')
        } else {
          const normalized = normalizeTypedDate(raw)
          if (normalized) onChange(normalized)
        }
        setDraft(null)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
      }}
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
