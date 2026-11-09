import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from 'cn'
import { moneyParts } from '../lib/money'

const amountVariants = cva('whitespace-nowrap tabular-nums', {
  variants: {
    size: {
      /** KPI / amount due. */
      hero: 'text-[40px] leading-[1.05] tracking-[-0.025em]',
      lg: 'text-[28px] leading-8 tracking-[-0.02em]',
      md: 'text-xl leading-7 tracking-[-0.01em]',
      /** Inline in tables and lists. */
      inline: 'text-sm font-medium',
      sm: 'text-[13px]',
    },
    tone: {
      default: '',
      muted: 'text-muted-foreground',
      /** Plain ink even when negative (net figures such as turnover with credit notes). */
      ink: '',
      /** Overdue: full destructive, the only alarming red. */
      overdue: 'text-destructive',
      success: 'text-success',
    },
  },
  defaultVariants: { size: 'inline', tone: 'default' },
})

/**
 * Money amount from a decimal string. Always Inter tabular;
 * haléře are dimmed; negative amounts get a real minus and a muted red (not alarming).
 */
function Amount({
  value,
  currency = 'CZK',
  size,
  tone,
  hideZeroFraction = false,
  className,
}: {
  /** Decimal string, e.g. "94985.00" (never a JS number). */
  value: string
  currency?: string
  /** Drop ",00" (compact lists); non-zero haléře always stay. */
  hideZeroFraction?: boolean
  className?: string
} & VariantProps<typeof amountVariants>) {
  const p = moneyParts(value, currency)
  const showFraction = !(hideZeroFraction && p.fraction === '00')
  const negativeTone = p.negative && (tone ?? 'default') === 'default'
  return (
    <span
      className={cn(
        amountVariants({ size, tone }),
        negativeTone && 'text-destructive/80',
        className,
      )}
      data-negative={p.negative || undefined}
    >
      {p.negative && '−'}
      {p.integer}
      {showFraction && <span className="opacity-60">,{p.fraction}</span>}
      {' '}
      <span className={cn(size === 'hero' || size === 'lg' ? 'text-[0.62em] opacity-80' : '')}>
        {p.currency}
      </span>
    </span>
  )
}

export { Amount, amountVariants }
