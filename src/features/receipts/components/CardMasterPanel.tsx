import { useMemo } from 'react'
import type { CardMasterEntry } from '../data/cardMaster'
import { Card } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { focusCellBelowOnEnter } from '../lib/tableKeyboardNav'

interface CardMasterPanelProps {
  cardMaster: CardMasterEntry[]
  onChange: (next: CardMasterEntry[]) => void
  onClose: () => void
}

// FR-5: 카드번호 뒤 4자리 ↔ 이용자명 매핑을 직접 추가/수정/삭제한다.
export function CardMasterPanel({ cardMaster, onChange, onClose }: CardMasterPanelProps) {
  function updateEntry(index: number, patch: Partial<CardMasterEntry>) {
    onChange(cardMaster.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)))
  }
  function deleteEntry(index: number) {
    onChange(cardMaster.filter((_, i) => i !== index))
  }
  function addEntry() {
    onChange([...cardMaster, { last4: '', name: '' }])
  }

  const duplicateLast4s = useMemo(() => {
    const counts = new Map<string, number>()
    for (const entry of cardMaster) {
      if (!entry.last4) continue
      counts.set(entry.last4, (counts.get(entry.last4) ?? 0) + 1)
    }
    return [...counts.entries()].filter(([, count]) => count > 1).map(([last4]) => last4)
  }, [cardMaster])

  return (
    <Card className="card-master-panel mb-4">
      <div className="card-master-panel__header">
        <h2>카드 마스터 목록 관리</h2>
        <Button variant="ghost" size="xs" onClick={onClose}>
          닫기
        </Button>
      </div>
      <p className="card-master-panel__hint">
        카드번호 뒤 4자리와 이용자명을 등록해두면 영수증 업로드 시 카드별 시트로 자동 분리됩니다. 하이패스처럼
        이용자명이 없는 카드는 비워두어도 됩니다.
      </p>

      {duplicateLast4s.length > 0 && (
        <div className="warning-banner">
          중복된 카드번호가 있습니다: {duplicateLast4s.join(', ')} — 카드별 시트가 겹칠 수 있으니 하나만 남겨주세요.
        </div>
      )}

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>카드번호 뒤 4자리</th>
              <th>이용자명</th>
              <th aria-label="삭제" />
            </tr>
          </thead>
          <tbody onKeyDown={focusCellBelowOnEnter}>
            {cardMaster.map((entry, i) => (
              // eslint-disable-next-line react/no-array-index-key
              <tr key={i}>
                <td>
                  <Input
                    value={entry.last4}
                    maxLength={4}
                    placeholder="0000"
                    onChange={(e) => updateEntry(i, { last4: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                  />
                </td>
                <td>
                  <Input
                    value={entry.name}
                    placeholder="(없음 — 예: 하이패스)"
                    onChange={(e) => updateEntry(i, { name: e.target.value })}
                  />
                </td>
                <td>
                  <Button variant="destructive" size="xs" onClick={() => deleteEntry(i)}>
                    삭제
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Button className="mt-2.5" onClick={addEntry}>
        + 카드 추가
      </Button>
    </Card>
  )
}
