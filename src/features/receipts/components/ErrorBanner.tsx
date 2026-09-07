import { Button } from './ui/button'

interface ErrorBannerProps {
  messages: string[]
  onDismiss: (index: number) => void
  variant?: 'error' | 'info'
}

export function ErrorBanner({ messages, onDismiss, variant = 'error' }: ErrorBannerProps) {
  if (messages.length === 0) return null

  const rootClass = variant === 'error' ? 'error-banner' : 'error-banner error-banner--info'

  return (
    <div className={rootClass}>
      {messages.map((message, index) => (
        <div className="error-banner__item" key={`${index}-${message}`}>
          <span>{message}</span>
          <Button
            variant="ghost"
            size="icon"
            className="text-inherit leading-none hover:bg-black/5"
            onClick={() => onDismiss(index)}
            aria-label="닫기"
          >
            ×
          </Button>
        </div>
      ))}
    </div>
  )
}
