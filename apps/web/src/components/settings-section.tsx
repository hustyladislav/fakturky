import { cn } from '@fakturky/ui/lib/utils'
import type { ReactNode } from 'react'

/**
 * A flat page section: hairline above, regular-weight h2, quiet description, optional action on the
 * right. Replaces the stack of cards on settings-like pages.
 */
export function SettingsSection({
  id,
  title,
  description,
  action,
  children,
  className,
}: {
  id?: string
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  children?: ReactNode
  className?: string
}) {
  return (
    <section
      id={id}
      className={cn(
        'hairline scroll-mt-32 pt-8 first:border-t-0 first:pt-0 lg:scroll-mt-20',
        className,
      )}
    >
      <header
        className={cn(
          'flex flex-wrap items-start justify-between gap-x-6 gap-y-3',
          children && 'mb-5',
        )}
      >
        <div className="min-w-0 max-w-[40rem]">
          <h2 className="text-xl leading-7">{title}</h2>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground text-pretty">{description}</p>
          )}
        </div>
        {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
      </header>
      {children}
    </section>
  )
}

/** Hairline-separated list of rows. */
export function RowList({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('divide-y divide-border border-y', className)}>{children}</div>
}

/** Label on the left, value and actions on the right; stacks on a phone. */
export function SettingsRow({
  label,
  hint,
  children,
  className,
}: {
  label: ReactNode
  hint?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6',
        className,
      )}
    >
      <div className="min-w-0 sm:max-w-[45%]">
        <div className="text-sm font-medium">{label}</div>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground text-pretty">{hint}</p>}
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">{children}</div>
    </div>
  )
}
