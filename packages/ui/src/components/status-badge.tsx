import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from 'cn'
import type { ComponentType } from 'react'
import { pluralDays } from '../lib/dates'

export type DocumentStatus = 'draft' | 'issued' | 'overdue' | 'partial' | 'paid' | 'cancelled'

const statusVariants = cva(
  'inline-flex h-6 min-w-[5.5rem] w-fit shrink-0 items-center gap-1.5 rounded-md px-2 text-xs font-medium whitespace-nowrap [&>svg]:size-3.5',
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

const dotVariants: Record<DocumentStatus, string> = {
  draft: 'border border-current bg-transparent',
  issued: 'bg-current',
  overdue: 'bg-current',
  partial: '[background:conic-gradient(currentColor_0_50%,transparent_0)] border border-current',
  paid: 'bg-current',
  cancelled: 'bg-current opacity-60',
}

/**
 * Status v2: 6 px dot + label on a soft tint. Meaning is carried by the label too, never colour alone.
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
