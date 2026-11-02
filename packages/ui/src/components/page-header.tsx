import { cn } from 'cn'
import type { ReactNode } from 'react'

/**
 * Page title block used on every page: optional eyebrow micro-label, Fraunces title (28/32),
 * a one-line context subtitle with live numbers, right-aligned actions, and a tabs slot beneath.
 */
function PageHeader({
  title,
  subtitle,
  eyebrow,
  actions,
  tabs,
  leading,
  className,
}: {
  title: ReactNode
  subtitle?: ReactNode
  eyebrow?: ReactNode
  actions?: ReactNode
  /** Usually a `<PageTabs>`; sits under the title on a hairline. */
  tabs?: ReactNode
  /** Left of the title (avatar, back button). */
  leading?: ReactNode
  className?: string
}) {
  return (
    <header className={cn('mb-6', className)}>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 items-center gap-4">
          {leading}
          <div className="min-w-0">
            {eyebrow && <div className="label-caps mb-1.5">{eyebrow}</div>}
            <h1 className="font-serif text-[28px] leading-8 font-medium tracking-[-0.015em] text-balance">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-1 text-sm text-muted-foreground tabular-nums">{subtitle}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {tabs && <div className="mt-5">{tabs}</div>}
    </header>
  )
}

export interface PageTab {
  id: string
  label: ReactNode
  count?: number
}

/** Underline tabs with counts; controlled. Sits on a hairline under the PageHeader. */
function PageTabs({
  items,
  value,
  onValueChange,
  label,
  className,
}: {
  items: PageTab[]
  value: string
  onValueChange: (id: string) => void
  label?: string
  className?: string
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn('hairline-b -mb-px flex gap-1 overflow-x-auto', className)}
    >
      {items.map((t) => {
        const active = t.id === value
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onValueChange(t.id)}
            className={cn(
              '-mb-px flex h-10 items-center gap-2 border-b-2 px-3 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:rounded-md focus-visible:ring-3 focus-visible:ring-ring/50',
              active
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span
                className={cn(
                  'rounded-full px-1.5 text-[11px] leading-5 font-semibold tabular-nums',
                  active ? 'bg-primary/12 text-primary' : 'bg-muted text-muted-foreground',
                )}
              >
                {t.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/** Section eyebrow: micro-label + hairline (like the PDF's section titles). */
function SectionLabel({
  children,
  action,
  className,
}: {
  children: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <h2 className="label-caps !font-sans !tracking-[0.08em] shrink-0">{children}</h2>
      <div className="h-px flex-1 bg-border" />
      {action}
    </div>
  )
}

export { PageHeader, PageTabs, SectionLabel }
