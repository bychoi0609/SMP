import { useState } from 'react'
import type { RawWorkbook } from '../lib/excelRead'
import { Card } from './ui/card'
import { Button } from './ui/button'

interface SheetPickerProps {
  workbook: RawWorkbook
  onConfirm: (selectedSheetNames: string[]) => void
  onCancel: () => void
}

// 하나의 엑셀 파일에 여러 시트가 있을 때(월별 탭 등) 가져올 시트를 선택하는 UI (FR-1).
export function SheetPicker({ workbook, onConfirm, onCancel }: SheetPickerProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set(workbook.sheets.map((s) => s.name)))

  function toggle(name: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  return (
    <Card className="sheet-picker mb-4">
      <p>
        <strong>{workbook.fileName}</strong>에 시트가 여러 개 있습니다. 가져올 시트를 선택하세요.
      </p>
      <ul>
        {workbook.sheets.map((sheet) => (
          <li key={sheet.name}>
            <label>
              <input
                type="checkbox"
                checked={selected.has(sheet.name)}
                onChange={() => toggle(sheet.name)}
                className="accent-primary-foreground"
              />
              {sheet.name}
            </label>
          </li>
        ))}
      </ul>
      <div className="sheet-picker__actions">
        <Button variant="outline" onClick={onCancel}>
          취소
        </Button>
        <Button onClick={() => onConfirm([...selected])} disabled={selected.size === 0}>
          가져오기
        </Button>
      </div>
    </Card>
  )
}
