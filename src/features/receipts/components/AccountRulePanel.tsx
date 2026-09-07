import { useMemo, useState } from 'react'
import type { AccountRuleDivision, AccountRuleEntry } from '../data/accountRules'
import { Card } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { focusCellBelowOnEnter } from '../lib/tableKeyboardNav'
import { handleInlineAutocompleteChange } from '../lib/inlineAutocomplete'
import { accountRuleKey } from '../lib/accountRules'
import { readWorkbookFromFile } from '../lib/excelRead'
import {
  downloadAccountRuleTemplate,
  parseAccountRuleRows,
  type ParsedAccountRuleRow,
} from '../lib/accountRuleImport'
import { FileDropzone } from './FileDropzone'

const IMPORT_STATUS_LABEL: Record<ParsedAccountRuleRow['status'], string> = {
  ok: '신규',
  duplicate: '중복',
  error: '오류',
}

interface AccountRulePanelProps {
  rules: AccountRuleEntry[]
  onChange: (next: AccountRuleEntry[]) => void
  onApply: () => void
  onClose: () => void
  accountCodeOptions: string[]
  paymentBasisOptions: string[]
}

const DIVISION_OPTIONS: AccountRuleDivision[] = ['매출', '매입', '영수증']

// 구분(매출/매입/영수증)별로 매칭 조건이 다르다.
// - 매출/매입: 사업자등록번호 + 품목명 패턴(부분 포함)
// - 영수증: 사업자등록번호·품목명이 없으므로 상호(가맹점명) 부분포함
export function AccountRulePanel({
  rules,
  onChange,
  onApply,
  onClose,
  accountCodeOptions,
  paymentBasisOptions,
}: AccountRulePanelProps) {
  function updateEntry(index: number, patch: Partial<AccountRuleEntry>) {
    onChange(rules.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)))
  }
  function deleteEntry(index: number) {
    onChange(rules.filter((_, i) => i !== index))
  }
  function addEntry() {
    onChange([
      ...rules,
      {
        division: '매출',
        bizNo: '',
        vendorName: '',
        itemPattern: '',
        accountName: '',
        siteCode: null,
        note: '',
        project: '',
        paymentBasisAccount: '',
      },
    ])
  }
  function resetAllEntries() {
    if (window.confirm(`규칙 ${rules.length}건을 모두 삭제하시겠습니까? 되돌릴 수 없습니다.`)) {
      onChange([])
    }
  }

  const duplicateLabels = useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>()
    for (const entry of rules) {
      const key = accountRuleKey(entry)
      if (!key) continue
      const label = entry.division === '영수증' ? `영수증 "${entry.vendorName}"` : `${entry.division} ${entry.bizNo}`
      const prev = counts.get(key)
      counts.set(key, { label, count: (prev?.count ?? 0) + 1 })
    }
    return [...counts.values()].filter((v) => v.count > 1).map((v) => v.label)
  }, [rules])

  const [showImport, setShowImport] = useState(false)
  const [importFileName, setImportFileName] = useState<string | null>(null)
  const [importRows, setImportRows] = useState<ParsedAccountRuleRow[]>([])
  const [importChecked, setImportChecked] = useState<Set<number>>(new Set())
  const [importError, setImportError] = useState<string | null>(null)

  function resetImport() {
    setShowImport(false)
    setImportFileName(null)
    setImportRows([])
    setImportChecked(new Set())
    setImportError(null)
  }

  async function handleImportFiles(files: File[]) {
    const file = files[0]
    if (!file) return
    setImportError(null)
    setImportRows([])
    try {
      const workbook = await readWorkbookFromFile(file)
      const sheet = workbook.sheets[0]
      if (!sheet) {
        setImportError('엑셀 파일에 시트가 없습니다.')
        return
      }
      const { parsed, headerError } = parseAccountRuleRows(sheet.rows, rules)
      if (headerError) {
        setImportError(headerError)
        return
      }
      if (parsed.length === 0) {
        setImportError('가져올 데이터가 없습니다.')
        return
      }
      setImportFileName(file.name)
      setImportRows(parsed)
      setImportChecked(new Set(parsed.flatMap((r, i) => (r.status === 'ok' ? [i] : []))))
    } catch (e) {
      setImportError(e instanceof Error ? e.message : '파일을 읽을 수 없습니다.')
    }
  }

  function toggleImportChecked(index: number) {
    setImportChecked((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  function applyImport() {
    const toAdd = importRows.filter((_, i) => importChecked.has(i)).map((r) => r.entry)
    if (toAdd.length > 0) onChange([...rules, ...toAdd])
    resetImport()
  }

  const importOkCount = importRows.filter((r) => r.status === 'ok').length
  const importDuplicateCount = importRows.filter((r) => r.status === 'duplicate').length
  const importErrorCount = importRows.filter((r) => r.status === 'error').length

  return (
    <Card className="card-master-panel mb-4">
      <div className="card-master-panel__header">
        <h2>계정과목 규칙 목록 관리</h2>
        <div className="flex gap-2">
          <Button size="xs" onClick={onApply}>
            적용
          </Button>
          <Button variant="ghost" size="xs" onClick={onClose}>
            닫기
          </Button>
        </div>
      </div>
      <p className="card-master-panel__hint">
        구분(매출/매입/영수증)별로 규칙을 등록하세요. 매출·매입은 사업자등록번호와 품목명 패턴(부분 포함, 비워두면
        해당 사업자의 모든 거래)으로 매칭되고, 영수증은 사업자등록번호·품목명이 없어 상호(가맹점명) 부분포함으로
        매칭됩니다. 매칭되면 각 구분에 해당하는 업로드 시 계정과목이 바로 채워집니다. 이미 업로드되어 있는 행에
        소급 적용하려면 "적용" 버튼을 눌러주세요(계정과목이 비어있는 행에만 채워지고, 이미 값이 있는 행은
        건드리지 않습니다). 구분번호를 지정하면 계정과목과 함께 세부내역까지 자동으로
        채워지고, 비고·프로젝트·대금기준을 지정하면 그 값도 함께 채워집니다(영수증은 비고·프로젝트·대금기준
        항목이 없어 적용되지 않습니다).
      </p>

      {duplicateLabels.length > 0 && (
        <div className="warning-banner">
          매칭 조건이 중복된 규칙이 있습니다: {duplicateLabels.join(', ')} — 하나만 남겨주세요.
        </div>
      )}

      <div className="table-scroll account-rule-scroll">
        <table>
          <thead>
            <tr>
              <th>구분</th>
              <th>사업자등록번호</th>
              <th>상호</th>
              <th>품목명 패턴</th>
              <th>계정과목</th>
              <th>구분번호</th>
              <th>비고</th>
              <th>프로젝트</th>
              <th>대금기준</th>
              <th aria-label="삭제" />
            </tr>
          </thead>
          <tbody onKeyDown={focusCellBelowOnEnter}>
            {rules.map((entry, i) => {
              const isReceipt = entry.division === '영수증'
              return (
                // eslint-disable-next-line react/no-array-index-key
                <tr key={i}>
                  <td>
                    <select
                      className="rounded-md border border-input bg-transparent px-2.5 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={entry.division}
                      onChange={(e) => updateEntry(i, { division: e.target.value as AccountRuleDivision })}
                    >
                      {DIVISION_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <Input
                      value={entry.bizNo}
                      placeholder={isReceipt ? '영수증에는 사용 안 함' : '000-00-00000'}
                      disabled={isReceipt}
                      onChange={(e) => updateEntry(i, { bizNo: e.target.value })}
                    />
                  </td>
                  <td>
                    <Input
                      value={entry.vendorName}
                      placeholder={isReceipt ? '가맹점명(부분포함 매칭)' : '상호(참고용)'}
                      onChange={(e) => updateEntry(i, { vendorName: e.target.value })}
                    />
                  </td>
                  <td>
                    <Input
                      value={entry.itemPattern}
                      placeholder={isReceipt ? '영수증에는 사용 안 함' : '부분 포함, 비우면 전체 적용'}
                      disabled={isReceipt}
                      onChange={(e) => updateEntry(i, { itemPattern: e.target.value })}
                    />
                  </td>
                  <td>
                    <Input
                      value={entry.accountName}
                      placeholder="계정과목"
                      onChange={(e) =>
                        handleInlineAutocompleteChange(e, accountCodeOptions, (v) => updateEntry(i, { accountName: v }))
                      }
                    />
                  </td>
                  <td>
                    <Input
                      value={entry.siteCode === null ? '' : String(entry.siteCode)}
                      placeholder="구분번호(선택)"
                      inputMode="numeric"
                      onChange={(e) => {
                        const digits = e.target.value.replace(/[^0-9]/g, '')
                        updateEntry(i, { siteCode: digits === '' ? null : Number(digits) })
                      }}
                    />
                  </td>
                  <td>
                    <Input
                      value={entry.note}
                      placeholder={isReceipt ? '영수증에는 사용 안 함' : '비고(선택)'}
                      disabled={isReceipt}
                      onChange={(e) => updateEntry(i, { note: e.target.value })}
                    />
                  </td>
                  <td>
                    <Input
                      value={entry.project}
                      placeholder={isReceipt ? '영수증에는 사용 안 함' : '프로젝트(선택)'}
                      disabled={isReceipt}
                      onChange={(e) => updateEntry(i, { project: e.target.value })}
                    />
                  </td>
                  <td>
                    <Input
                      value={entry.paymentBasisAccount}
                      placeholder={isReceipt ? '영수증에는 사용 안 함' : '대금기준(선택)'}
                      disabled={isReceipt}
                      onChange={(e) =>
                        handleInlineAutocompleteChange(e, paymentBasisOptions, (v) =>
                          updateEntry(i, { paymentBasisAccount: v }),
                        )
                      }
                    />
                  </td>
                  <td>
                    <Button variant="destructive" size="xs" onClick={() => deleteEntry(i)}>
                      삭제
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-2.5 flex gap-2">
        <Button onClick={addEntry}>+ 규칙 추가</Button>
        <Button onClick={() => setShowImport((prev) => !prev)}>엑셀로 추가</Button>
        <Button onClick={resetAllEntries}>초기화</Button>
      </div>

      {showImport && (
        <div className="account-rule-import mt-3">
          <div className="account-rule-import__header">
            <h3>엑셀로 일괄 추가</h3>
            <Button onClick={downloadAccountRuleTemplate}>엑셀 양식 다운로드</Button>
          </div>

          <FileDropzone
            label="양식에 맞춰 작성한 엑셀 파일(.xlsx/.xls)을 여기로 드래그하세요."
            buttonLabel="파일 선택"
            compact
            onFiles={handleImportFiles}
          />

          {importError && <div className="warning-banner mb-3">{importError}</div>}

          {importRows.length > 0 && (
            <>
              <p className="card-master-panel__hint">
                &quot;{importFileName}&quot; — 총 {importRows.length}행 중 신규 {importOkCount}행, 중복{' '}
                {importDuplicateCount}행, 오류 {importErrorCount}행. 체크된 항목만 추가됩니다(오류 행은 선택할 수
                없습니다).
              </p>
              <div className="table-scroll account-rule-import__scroll">
                <table>
                  <thead>
                    <tr>
                      <th aria-label="포함" />
                      <th>행</th>
                      <th>상태</th>
                      <th>구분</th>
                      <th>사업자등록번호</th>
                      <th>상호</th>
                      <th>품목명 패턴</th>
                      <th>계정과목</th>
                      <th>구분번호</th>
                      <th>비고</th>
                      <th>프로젝트</th>
                      <th>대금기준</th>
                      <th>메시지</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importRows.map((r, i) => (
                      // eslint-disable-next-line react/no-array-index-key
                      <tr key={i} className={`account-rule-import__row--${r.status}`}>
                        <td>
                          <input
                            type="checkbox"
                            checked={importChecked.has(i)}
                            disabled={r.status === 'error'}
                            onChange={() => toggleImportChecked(i)}
                          />
                        </td>
                        <td>{r.rowNumber}</td>
                        <td>{IMPORT_STATUS_LABEL[r.status]}</td>
                        <td>{r.entry.division}</td>
                        <td>{r.entry.bizNo}</td>
                        <td>{r.entry.vendorName}</td>
                        <td>{r.entry.itemPattern}</td>
                        <td>{r.entry.accountName}</td>
                        <td>{r.entry.siteCode ?? ''}</td>
                        <td>{r.entry.note}</td>
                        <td>{r.entry.project}</td>
                        <td>{r.entry.paymentBasisAccount}</td>
                        <td>{r.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="sheet-picker__actions mt-2.5">
                <Button variant="outline" onClick={resetImport}>
                  취소
                </Button>
                <Button onClick={applyImport} disabled={importChecked.size === 0}>
                  선택한 {importChecked.size}건 추가
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </Card>
  )
}
