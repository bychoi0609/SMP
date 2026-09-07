import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { Button } from './ui/button'

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
}

// 탭 클릭 시 배경을 어둡게 오버레이 처리하고 데이터를 편집할 수 있는 간이 창을 띄운다.
export function Modal({ title, onClose, children }: ModalProps) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-content__header">
          <h2>{title}</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="닫기">
            ✕
          </Button>
        </div>
        <div className="modal-content__body">{children}</div>
      </div>
    </div>
  )
}
