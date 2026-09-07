import type { KeyboardEvent } from 'react'

// 엑셀처럼 표 셀에서 Enter를 누르면 같은 열의 바로 아래 행으로 포커스를 옮긴다.
export function focusCellBelowOnEnter(e: KeyboardEvent<HTMLElement>) {
  if (e.key !== 'Enter') return

  const target = e.target as HTMLElement
  const cell = target.closest('td')
  const row = cell?.closest('tr')
  if (!cell || !row) return

  const cellIndex = Array.prototype.indexOf.call(row.children, cell)
  const nextRow = row.nextElementSibling
  if (!nextRow) return

  const nextCell = nextRow.children[cellIndex]
  const focusable = nextCell?.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
    'input, select, textarea',
  )
  if (!focusable) return

  e.preventDefault()
  focusable.focus()
  if (focusable instanceof HTMLInputElement) focusable.select()
}

// selectionStart/selectionEnd(커서 위치)를 지원하는 input type만. type=date/number 등은
// 접근 시 브라우저가 예외를 던지므로 이 목록에 없는 타입은 커서 경계를 확인하지 않는다.
const TEXT_CARET_INPUT_TYPES = new Set(['text', 'search', 'tel', 'url', 'password'])

// 표 셀에서 방향키로 상하좌우 인접 셀로 포커스를 옮긴다(엑셀 스타일 이동).
// - 상/하: 항상 이동(달력/셀렉트의 값 증감보다 셀 이동을 우선).
// - 좌/우: 텍스트 입력 중이면 커서가 맨 앞/뒤에 있을 때만 이동해 텍스트 편집(커서 이동)을 방해하지 않는다.
//   type=date/select 등 커서 개념이 없는 입력은 항상 이동시킨다 — 일/월/년 구간 전환은 클릭으로 하면 된다.
export function focusCellOnArrowKey(e: KeyboardEvent<HTMLElement>) {
  const key = e.key
  if (key !== 'ArrowUp' && key !== 'ArrowDown' && key !== 'ArrowLeft' && key !== 'ArrowRight') return

  const target = e.target as HTMLElement

  if (key === 'ArrowLeft' || key === 'ArrowRight') {
    if (target instanceof HTMLInputElement && TEXT_CARET_INPUT_TYPES.has(target.type)) {
      const atStart = target.selectionStart === 0 && target.selectionEnd === 0
      const atEnd = target.selectionStart === target.value.length && target.selectionEnd === target.value.length
      if (key === 'ArrowLeft' && !atStart) return
      if (key === 'ArrowRight' && !atEnd) return
    }
  }

  const cell = target.closest('td')
  const row = cell?.closest('tr')
  if (!cell || !row) return

  const cellIndex = Array.prototype.indexOf.call(row.children, cell)

  let targetRow: Element | null = row
  if (key === 'ArrowUp') targetRow = row.previousElementSibling
  if (key === 'ArrowDown') targetRow = row.nextElementSibling
  if (!targetRow) return

  let targetCellIndex = cellIndex
  if (key === 'ArrowLeft') targetCellIndex = cellIndex - 1
  if (key === 'ArrowRight') targetCellIndex = cellIndex + 1

  const targetCell = targetRow.children[targetCellIndex]
  const focusable = targetCell?.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
    'input, select, textarea',
  )
  if (!focusable) return

  e.preventDefault()
  focusable.focus()
  if (focusable instanceof HTMLInputElement && TEXT_CARET_INPUT_TYPES.has(focusable.type)) focusable.select()
}
