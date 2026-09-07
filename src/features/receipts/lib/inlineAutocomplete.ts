import type { ChangeEvent } from 'react'

// 엑셀처럼: 입력한 접두사와 일치하는 이전 값이 있으면 나머지를 자동으로 채우고, 채워진 부분은
// 선택 상태로 남겨 계속 입력하면 덮어쓰고 그대로 두면(Enter/Tab 등) 그 값으로 확정된다.
// 지우는 입력(Backspace/Delete)에는 다시 자동완성을 붙이지 않는다 — 그렇지 않으면 지운 부분이
// 바로 다시 채워져서 지울 수가 없다.
export function handleInlineAutocompleteChange(
  e: ChangeEvent<HTMLInputElement>,
  options: string[],
  onChange: (value: string) => void,
) {
  const input = e.target
  const typed = input.value
  const inputType = (e.nativeEvent as InputEvent).inputType
  const isDeleting = typeof inputType === 'string' && inputType.startsWith('delete')

  if (isDeleting || typed.trim() === '') {
    onChange(typed)
    return
  }

  const match = options.find((opt) => opt.length > typed.length && opt.startsWith(typed))
  if (!match) {
    onChange(typed)
    return
  }

  onChange(match)
  requestAnimationFrame(() => {
    input.setSelectionRange(typed.length, match.length)
  })
}
