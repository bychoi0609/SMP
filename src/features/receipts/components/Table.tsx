import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { focusCellBelowOnEnter, focusCellOnArrowKey } from '../lib/tableKeyboardNav'

export interface Column<T> {
  key: string
  label: ReactNode
  align?: 'left' | 'center' | 'right'
  // 값이 잘려 보이는 컬럼(상호, 합계금액 등)에 지정해 입력창이 값을 다 보여줄 만큼 넓어지도록 한다.
  minWidth?: number
  render: (row: T, rowIndex: number) => ReactNode
  // 정렬/검색 대상 컬럼이면 지정. 원본 데이터(row)를 기준으로 값을 뽑아온다.
  sortValue?: (row: T) => string | number
  searchValue?: (row: T) => string
  // 검색창의 "카테고리" 드롭다운에 보여줄 이름. 없으면 key를 그대로 쓴다.
  searchLabel?: string
}

interface TableProps<T> {
  columns: Column<T>[]
  rows: T[]
  emptyMessage?: string
  onDeleteRow?: (rowIndex: number) => void
  // true를 반환한 행은 삭제 버튼을 비활성화한다(확정되어 잠긴 행).
  isRowDisabled?: (rowIndex: number) => boolean
  onAddRow?: () => void
  addRowLabel?: string
  onClearAll?: () => void
  clearAllLabel?: string
  // true면 onClearAll을 확인창 없이 바로 호출한다 (호출자가 직접 확인 절차를 처리하는 경우, 예: 월별 필터).
  skipClearAllConfirm?: boolean
  searchPlaceholder?: string
  // true면 표 자체의 검색창/카테고리 드롭다운을 숨긴다(호출자가 상단에 별도 검색 UI를 두는 경우, 예: 월별 조회 화면).
  hideSearch?: boolean
  // 전체 초기화/행 추가 버튼 옆에 붙는 추가 버튼(예: 엑셀 다운로드) — 같은 툴바 줄에서 간격을 좁게 유지한다.
  toolbarExtra?: ReactNode
  // 툴바(검색/행 추가 등)와 표 본문 사이에 끼워 넣을 내용 (예: 영수증 카드 선택 탭).
  belowToolbar?: ReactNode
  // 표 하단 합계 행. 컬럼 key로 값을 조회하며, 검색/정렬과 무관하게 rows 전체 기준으로 계산해야 한다.
  footerCells?: (rows: T[]) => Record<string, ReactNode>
}

type SortDir = 'asc' | 'desc'

export function Table<T>({
  columns,
  rows,
  emptyMessage = '표시할 데이터가 없습니다.',
  onDeleteRow,
  isRowDisabled,
  onAddRow,
  addRowLabel = '+ 행 추가',
  onClearAll,
  clearAllLabel = '전체 초기화',
  skipClearAllConfirm = false,
  searchPlaceholder = '검색...',
  hideSearch = false,
  toolbarExtra,
  belowToolbar,
  footerCells,
}: TableProps<T>) {
  const [searchText, setSearchText] = useState('')
  const [searchCategory, setSearchCategory] = useState('all')
  const [sort, setSort] = useState<{ key: string; dir: SortDir } | null>(null)

  const searchableColumns = useMemo(() => columns.filter((c) => c.searchValue), [columns])
  const activeSearchColumns = useMemo(
    () => (searchCategory === 'all' ? searchableColumns : searchableColumns.filter((c) => c.key === searchCategory)),
    [searchableColumns, searchCategory],
  )
  const searchPlaceholderText =
    searchCategory === 'all'
      ? searchPlaceholder
      : `${searchableColumns.find((c) => c.key === searchCategory)?.searchLabel ?? searchCategory} 검색...`

  const viewIndices = useMemo(() => {
    let indices = rows.map((_, i) => i)

    const q = searchText.trim().toLowerCase()
    if (q && activeSearchColumns.length > 0) {
      indices = indices.filter((i) =>
        activeSearchColumns.some((c) => c.searchValue!(rows[i]).toLowerCase().includes(q)),
      )
    }

    if (sort) {
      const col = columns.find((c) => c.key === sort.key)
      if (col?.sortValue) {
        const dirMul = sort.dir === 'asc' ? 1 : -1
        indices = [...indices].sort((a, b) => {
          const va = col.sortValue!(rows[a])
          const vb = col.sortValue!(rows[b])
          if (va < vb) return -1 * dirMul
          if (va > vb) return 1 * dirMul
          return 0
        })
      }
    }

    return indices
  }, [rows, searchText, activeSearchColumns, sort, columns])

  function toggleSort(col: Column<T>) {
    if (!col.sortValue) return
    setSort((prev) => {
      if (!prev || prev.key !== col.key) return { key: col.key, dir: 'asc' }
      if (prev.dir === 'asc') return { key: col.key, dir: 'desc' }
      return null
    })
  }

  function handleClearAll() {
    if (!onClearAll || rows.length === 0) return
    if (skipClearAllConfirm) {
      onClearAll()
      return
    }
    if (window.confirm(`${rows.length}건의 데이터를 모두 초기화하시겠습니까? 되돌릴 수 없습니다.`)) {
      onClearAll()
    }
  }

  return (
    <div className="data-table">
      <div className="data-table__toolbar">
        {!hideSearch && (
          <div className="data-table__search-group">
            {searchableColumns.length > 1 && (
              <select
                className="rounded-md border border-input bg-transparent text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-table__search-category"
                value={searchCategory}
                onChange={(e) => setSearchCategory(e.target.value)}
              >
                <option value="all">전체</option>
                {searchableColumns.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.searchLabel ?? c.key}
                  </option>
                ))}
              </select>
            )}
            <Input
              type="search"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder={searchPlaceholderText}
              className="data-table__search"
            />
          </div>
        )}
        <div className="data-table__toolbar-actions">
          {onClearAll && (
            <Button disabled={rows.length === 0} onClick={handleClearAll}>
              {clearAllLabel}
            </Button>
          )}
          {onAddRow && <Button onClick={onAddRow}>{addRowLabel}</Button>}
          {toolbarExtra}
        </div>
      </div>

      {belowToolbar}

      {rows.length === 0 ? (
        <p className="table-empty">{emptyMessage}</p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {columns.map((col) => {
                  const isSorted = sort?.key === col.key
                  return (
                    <th
                      key={col.key}
                      style={{ textAlign: 'center', minWidth: col.minWidth }}
                      className={col.sortValue ? 'sortable' : undefined}
                      onClick={() => toggleSort(col)}
                    >
                      {col.label}
                      {isSorted && (sort!.dir === 'asc' ? ' ▲' : ' ▼')}
                    </th>
                  )
                })}
                {onDeleteRow && <th aria-label="행 삭제" />}
              </tr>
            </thead>
            <tbody
              onKeyDown={(e) => {
                focusCellBelowOnEnter(e)
                focusCellOnArrowKey(e)
              }}
            >
              {viewIndices.length === 0 && (
                <tr>
                  <td colSpan={columns.length + (onDeleteRow ? 1 : 0)} className="table-empty">
                    검색 결과가 없습니다.
                  </td>
                </tr>
              )}
              {viewIndices.map((rowIndex) => (
                <tr key={rowIndex}>
                  {columns.map((col) => (
                    <td key={col.key} style={{ textAlign: col.align ?? 'left', minWidth: col.minWidth }}>
                      {col.render(rows[rowIndex], rowIndex)}
                    </td>
                  ))}
                  {onDeleteRow && (
                    <td>
                      <Button
                        variant="destructive"
                        size="xs"
                        aria-label="행 삭제"
                        disabled={isRowDisabled?.(rowIndex)}
                        onClick={() => onDeleteRow(rowIndex)}
                      >
                        삭제
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            {footerCells && (
              <tfoot>
                <tr>
                  {(() => {
                    const cells = footerCells(rows)
                    return columns.map((col) => (
                      <td key={col.key} style={{ textAlign: col.align ?? 'left', minWidth: col.minWidth }}>
                        {cells[col.key] ?? ''}
                      </td>
                    ))
                  })()}
                  {onDeleteRow && <td />}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  )
}
