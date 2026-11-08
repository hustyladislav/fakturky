import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from 'cn'
import type { ComponentType } from 'react'
import { pluralDays } from '../lib/dates'

export type DocumentStatus = 'draft' | 'issued' | 'overdue' | 'partial' | 'paid' | 'cancelled'

const statusVariants = cva(
  'inline-flex w-fit shrink-0 items-center gap-1.5 text-[13px] whitespace-nowrap [&>svg]:size-3.5',
  {
    variants: {
      status: {
        draft: 'text-muted-foreground',
        issued: 'text-info',
        overdue: 'text-destructive',
        partial: 'text-warning',
        paid: 'text-success',
        cancelled: 'text-muted-foreground line-through',
      },
    },
  },
)

const dotVariants: Record<DocumentStatus, string> = {
  draft: 'border border-current bg-transparent',
  issued: 'bg-current',
  overdue: 'bg-current',
  partial: '[background:conic-gradient(currentColor_0_50%,transparent_0)] border border-current',
  paid: 'bg-current',
  cancelled: 'bg-current opacity-60',
}

/**
 * dot + label, no pill. Meaning is carried by the label too, never colour alone.
 * With `overdueDays` an overdue badge reads "14 dní po splatnosti" (the children are replaced).
 */
function StatusBadge({
  status,
  children,
  className,
  icon: Icon,
  overdueDays,
}: {
  status: DocumentStatus
  children?: React.ReactNode
  className?: string
  /** Replaces the dot (e.g. an assistant-drafted badge). */
  icon?: ComponentType<{ 'aria-hidden'?: boolean }>
  overdueDays?: number
} & Required<Pick<VariantProps<typeof statusVariants>, 'status'>>) {
  const label =
    status === 'overdue' && overdueDays && overdueDays > 0
      ? `${pluralDays(overdueDays)} po splatnosti`
      : children
  return (
    <span className={cn(statusVariants({ status }), className)} data-status={status}>
      {Icon ? (
        <Icon aria-hidden />
      ) : (
        <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', dotVariants[status])} />
      )}
      {label}
    </span>
  )
}

export { StatusBadge, statusVariants }
