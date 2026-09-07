import { useEffect, useState } from 'react'

const PREFIX = 'solar:'

// 새로고침/재접속해도 작업 중이던 데이터가 유지되도록 localStorage에 자동 저장한다 (PRD §6).
export function usePersistentState<T>(key: string, initialValue: T) {
  const storageKey = `${PREFIX}${key}`
  const [state, setState] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(storageKey)
      return raw ? (JSON.parse(raw) as T) : initialValue
    } catch {
      return initialValue
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(state))
    } catch {
      // 저장소 용량 초과 등은 조용히 무시 — 화면상의 작업은 계속 가능해야 함
    }
  }, [storageKey, state])

  return [state, setState] as const
}
