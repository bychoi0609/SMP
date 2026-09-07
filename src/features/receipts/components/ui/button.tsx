import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-transparent font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/85',
        outline: 'bg-transparent border-border text-foreground hover:bg-muted',
        ghost: 'border-transparent bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
        destructive: 'border-transparent bg-transparent text-destructive hover:bg-destructive/10',
        pill: 'rounded-full border-border bg-transparent text-muted-foreground hover:bg-muted',
      },
      size: {
        default: 'py-[2px] px-[10px] text-sm',
        xs: 'py-0 px-[8px] text-sm',
        icon: 'p-1 text-base leading-none',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
}
