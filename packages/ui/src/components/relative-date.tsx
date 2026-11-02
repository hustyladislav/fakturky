import { cn } from 'cn'
import { diffDays, formatDate, parseIsoDate, relativeDayLabel, startOfDay } from '../lib/dates'
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip'

/**
 * Czech relative date ("za 5 dní", "dnes", "včera", "před 3 dny") with the exact date in a tooltip.
 * `tone="due"` colours past dates destructive (use for due dates of unpaid documents).
 */
function RelativeDate({
  date,
  now,
  tone = 'default',
  className,
}: {
  /** `YYYY-MM-DD` or Date. */
  date: string | Date | null | undefined
  /** Reference "today" (defaults to the current day). */
  now?: Date
  tone?: 'default' | 'due'
  className?: string
}) {
  const d = parseIsoDate(date)
  if (!d) return <span className={cn('text-muted-foreground', className)}>—</span>
  const days = diffDays(d, startOfDay(now ?? new Date()))
  return (
    <Tooltip>
      <TooltipTrigger
        render={<time dateTime={formatIso(d)} suppressHydrationWarning />}
        className={cn(
          'cursor-default whitespace-nowrap tabular-nums',
          tone === 'due' && days < 0 && 'font-medium text-destructive',
          className,
        )}
      >
        {relativeDayLabel(days)}
      </TooltipTrigger>
      <TooltipContent>{formatDate(d)}</TooltipContent>
    </Tooltip>
  )
}

function formatIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export { RelativeDate }
