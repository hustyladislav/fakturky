import { cn } from 'cn'
import type { ComponentType, ReactNode } from 'react'

/** Calm empty state: icon, one sentence of what this is, one clear next action. */
function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  className,
}: {
  icon?: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  title: string
  children?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center',
        className,
      )}
    >
      {Icon && (
        <span className="flex size-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Icon className="size-5" aria-hidden />
        </span>
      )}
      <h2 className="font-serif text-xl font-medium">{title}</h2>
      {children && <p className="max-w-sm text-sm text-muted-foreground">{children}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}

export { EmptyState }
