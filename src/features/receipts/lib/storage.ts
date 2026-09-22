import { useEffect, useRef, useState } from 'react'

import { getReceiptDraftStateAction, setReceiptDraftStateAction } from '@/app/receipts/actions'

const SAVE_DEBOUNCE_MS = 800
// 이 훅이 localStorage에만 저장하던 시절에 쓰던 키 접두어 — 서버에 아직 값이 없을 때만
// 1회성으로 읽어서 서버로 옮기는 마이그레이션 용도로만 남겨둔다.
const LEGACY_PREFIX = 'solar:'

// 새로고침/재접속은 물론 다른 컴퓨터에서 접속해도 작업 중이던 데이터가 유지되도록 서버(DB)에
// 자동 저장한다 (PRD §6). 예전에는 브라우저 localStorage에만 저장돼 다른 컴퓨터에서는 작업
// 내용이 보이지 않는 문제가 있었다.
export function usePersistentState<T>(key: string, initialValue: T) {
  const [state, setState] = useState<T>(initialValue)
  const loadedRef = useRef(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 마운트 시 서버에서 저장된 draft를 불러온다. 로드가 끝나기 전까지는 아래 저장 effect가
  // initialValue로 서버 값을 덮어쓰지 않도록 loadedRef로 막는다.
  useEffect(() => {
    let cancelled = false
    loadedRef.current = false
    getReceiptDraftStateAction(key).then((value) => {
      if (cancelled) return
      if (value !== null) {
        setState(value as T)
      } else {
        // 서버에 값이 없으면(이 키를 처음 저장하는 경우), localStorage 시절 값이 이 브라우저에
        // 남아있는지 확인해 그대로 서버로 옮긴다 — 이 변경 배포 직후 기존 작업 내용이 빈 값으로
        // 보이지 않게 하기 위한 1회성 이전 처리.
        const legacy = readLegacyValue<T>(key)
        if (legacy !== null) {
          setState(legacy)
          setReceiptDraftStateAction(key, legacy)
            .then(() => {
              try {
                window.localStorage.removeItem(`${LEGACY_PREFIX}${key}`)
              } catch {
                // 정리 실패는 무시 — 다음부터는 서버 값이 우선이라 문제 없음
              }
            })
            .catch(() => {})
        }
      }
      loadedRef.current = true
    })
    return () => {
      cancelled = true
    }
  }, [key])

  useEffect(() => {
    if (!loadedRef.current) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setReceiptDraftStateAction(key, state).catch(() => {
        // 저장 실패는 조용히 무시 — 다음 변경 시 다시 시도된다
      })
    }, SAVE_DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [key, state])

  return [state, setState] as const
}

function readLegacyValue<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(`${LEGACY_PREFIX}${key}`)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}
