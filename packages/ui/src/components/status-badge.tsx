import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from 'cn'
import { Ban, Check, CircleDashed, CircleDot, Clock, Send } from 'lucide-react'
import type { ComponentType } from 'react'

export type DocumentStatus = 'draft' | 'issued' | 'overdue' | 'partial' | 'paid' | 'cancelled'

const statusVariants = cva(
  'inline-flex h-6 w-fit shrink-0 items-center gap-1.5 rounded-md px-2 text-xs font-medium whitespace-nowrap [&>svg]:size-3.5',
  {
    variants: {
      status: {
        draft: 'bg-muted text-muted-foreground',
        issued: 'bg-info/12 text-info',
        overdue: 'bg-destructive/12 text-destructive',
        partial: 'bg-warning/14 text-[color-mix(in_srgb,var(--warning),var(--foreground)_40%)]',
        paid: 'bg-success/12 text-success',
        cancelled: 'bg-muted text-muted-foreground line-through',
      },
    },
  },
)

const icons: Record<DocumentStatus, ComponentType<{ 'aria-hidden'?: boolean }>> = {
  draft: CircleDashed,
  issued: Send,
  overdue: Clock,
  partial: CircleDot,
  paid: Check,
  cancelled: Ban,
}

/** Status = icon + text + colour, never colour alone. The label is passed in (Czech lives in i18n). */
function StatusBadge({
  status,
  children,
  className,
  icon,
}: {
  status: DocumentStatus
  children: React.ReactNode
  className?: string
  icon?: ComponentType<{ 'aria-hidden'?: boolean }>
} & Required<Pick<VariantProps<typeof statusVariants>, 'status'>>) {
  const Icon = icon ?? icons[status]
  return (
    <span className={cn(statusVariants({ status }), className)}>
      <Icon aria-hidden />
      {children}
    </span>
  )
}

export { StatusBadge, statusVariants }
