'use client'

import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Modal } from './Modal'
import { Button } from './ui/button'
import { formatNumber } from '../lib/format'
import { MANUAL_SECTIONS, SECTION_LABEL, type ManualEntryDTO, type ManualSection } from '../lib/profitLoss'
import {
  createProfitLossManualEntryAction,
  deleteProfitLossManualEntryAction,
  updateProfitLossManualEntryAction,
} from '@/app/receipts/profit-loss/actions'
import { profitLossManualEntrySchema } from '@/lib/validations/profit-loss'

// 증빙이 없어 자동 집계되지 않는 항목의 자주 쓰는 계정과목 — 자동완성 후보로만 쓰고 값은 자유 입력.
const COMMON_MANUAL_ACCOUNTS = ['급여', '퇴직급여', '4대보험료', '감가상각비', '이자비용', '이자수익', '재고조정']

interface FormState {
  section: ManualSection
  accountCode: string
  amount: string
  memo: string
}

const EMPTY_FORM: FormState = { section: 'SGA', accountCode: '', amount: '', memo: '' }

interface ProfitLossManualPanelProps {
  entries: ManualEntryDTO[]
  initialMonth: string // 'YYYY-MM'
  accountSuggestions: string[]
  onClose: () => void
}

export function ProfitLossManualPanel({ entries, initialMonth, accountSuggestions, onClose }: ProfitLossManualPanelProps) {
  const [month, setMonth] = useState(initialMonth)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [isPending, startTransition] = useTransition()

  const monthEntries = useMemo(() => entries.filter((e) => e.billingYearMonth === month), [entries, month])
  const suggestions = useMemo(
    () => [...new Set([...COMMON_MANUAL_ACCOUNTS, ...accountSuggestions, ...entries.map((e) => e.accountCode)])],
    [accountSuggestions, entries],
  )

  function resetForm() {
    setForm(EMPTY_FORM)
    setEditingId(null)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const input = {
      billingYearMonth: month,
      section: form.section,
      accountCode: form.accountCode,
      amount: form.amount.replace(/,/g, ''),
      memo: form.memo,
    }
    const parsed = profitLossManualEntrySchema.safeParse(input)
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? '입력값을 확인해 주세요.')
      return
    }
    startTransition(async () => {
      const result =
        editingId === null
          ? await createProfitLossManualEntryAction(input)
          : await updateProfitLossManualEntryAction(editingId, input)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(editingId === null ? '수기 항목을 추가했어요.' : '수기 항목을 수정했어요.')
      resetForm()
    })
  }

  function handleEdit(entry: ManualEntryDTO) {
    setEditingId(entry.id)
    setForm({
      section: entry.section,
      accountCode: entry.accountCode,
      amount: String(entry.amount),
      memo: entry.memo,
    })
  }

  function handleDelete(entry: ManualEntryDTO) {
    if (!window.confirm(`${entry.accountCode} ${formatNumber(entry.amount)}원 항목을 삭제할까요?`)) return
    startTransition(async () => {
      const result = await deleteProfitLossManualEntryAction(entry.id)
      if (result.error) {
        toast.error(result.error)
        return
      }
      if (editingId === entry.id) resetForm()
      toast.success('수기 항목을 삭제했어요.')
    })
  }

  const inputClass = 'h-8 rounded-md border border-input bg-transparent px-2 text-sm'

  return (
    <Modal title="수기 항목" onClose={onClose}>
      <p className="mb-3 text-sm text-muted-foreground">
        급여·4대보험·감가상각·이자처럼 세금계산서나 영수증이 없는 항목을 귀속월별로 입력해 주세요. 입력한 금액은 같은
        구분·계정과목 줄에 더해져요. 재고 조정처럼 빼야 하는 금액은 음수로 입력하시면 돼요.
      </p>

      <form onSubmit={handleSubmit} className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">귀속월</span>
          <input
            type="month"
            value={month}
            onChange={(e) => {
              setMonth(e.target.value)
              resetForm()
            }}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">구분</span>
          <select
            value={form.section}
            onChange={(e) => setForm({ ...form, section: e.target.value as ManualSection })}
            className={inputClass}
          >
            {MANUAL_SECTIONS.map((s) => (
              <option key={s} value={s}>
                {SECTION_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">계정과목</span>
          <input
            type="text"
            list="profit-loss-account-suggestions"
            value={form.accountCode}
            onChange={(e) => setForm({ ...form, accountCode: e.target.value })}
            placeholder="예: 급여"
            className={`${inputClass} w-36`}
          />
          <datalist id="profit-loss-account-suggestions">
            {suggestions.map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">금액(원)</span>
          <input
            type="text"
            inputMode="numeric"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            placeholder="0"
            className={`${inputClass} w-36 text-right tabular-nums`}
          />
        </label>
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-xs text-muted-foreground">메모</span>
          <input
            type="text"
            value={form.memo}
            onChange={(e) => setForm({ ...form, memo: e.target.value })}
            className={`${inputClass} min-w-40`}
          />
        </label>
        <div className="flex gap-2">
          {editingId !== null && (
            <Button variant="outline" onClick={resetForm} className="h-8 px-3 py-0">
              취소
            </Button>
          )}
          <Button type="submit" disabled={isPending} className="h-8 px-4 py-0">
            {editingId === null ? '추가' : '수정 저장'}
          </Button>
        </div>
      </form>

      <div className="rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-1.5 text-left font-medium">구분</th>
              <th className="px-3 py-1.5 text-left font-medium">계정과목</th>
              <th className="px-3 py-1.5 text-right font-medium">금액</th>
              <th className="px-3 py-1.5 text-left font-medium">메모</th>
              <th className="w-28 px-3 py-1.5" />
            </tr>
          </thead>
          <tbody>
            {monthEntries.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                  {month} 수기 항목이 아직 없어요.
                </td>
              </tr>
            ) : (
              monthEntries.map((entry) => (
                <tr key={entry.id} className={editingId === entry.id ? 'bg-accent' : 'border-t'}>
                  <td className="px-3 py-1.5">{SECTION_LABEL[entry.section]}</td>
                  <td className="px-3 py-1.5">{entry.accountCode}</td>
                  <td className="px-3 py-1.5 text-right font-mono tabular-nums">{formatNumber(entry.amount)}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">{entry.memo}</td>
                  <td className="px-3 py-1.5 text-right">
                    <Button variant="ghost" size="xs" onClick={() => handleEdit(entry)} disabled={isPending}>
                      수정
                    </Button>
                    <Button variant="destructive" size="xs" onClick={() => handleDelete(entry)} disabled={isPending}>
                      삭제
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Modal>
  )
}
