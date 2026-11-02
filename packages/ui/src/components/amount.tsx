import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from 'cn'
import { useCountUp } from '../hooks/use-count-up'
import { moneyParts } from '../lib/money'

const amountVariants = cva('whitespace-nowrap tabular-nums', {
  variants: {
    size: {
      /** KPI / amount due: Fraunces. */
      hero: 'font-serif text-[44px] leading-[1.05] font-medium tracking-[-0.02em]',
      lg: 'font-serif text-[28px] leading-8 font-medium tracking-[-0.01em]',
      md: 'font-serif text-xl leading-7 font-medium',
      /** Inline in tables and lists: Inter tabular. */
      inline: 'text-sm font-medium',
      sm: 'text-[13px]',
    },
    tone: {
      default: '',
      muted: 'text-muted-foreground',
      /** Overdue: full destructive, the only alarming red. */
      overdue: 'text-destructive',
      success: 'text-success',
    },
  },
  defaultVariants: { size: 'inline', tone: 'default' },
})

/**
 * Money amount from a decimal string. Hero sizes use Fraunces, inline uses Inter tabular;
 * haléře are dimmed; negative amounts get a real minus and a muted red (not alarming).
 * `animate` counts up once on first paint (reduced-motion safe).
 */
function Amount({
  value,
  currency = 'CZK',
  size,
  tone,
  animate = false,
  hideZeroFraction = false,
  className,
}: {
  /** Decimal string, e.g. "94985.00" (never a JS number). */
  value: string
  currency?: string
  animate?: boolean
  /** Drop ",00" (compact lists); non-zero haléře always stay. */
  hideZeroFraction?: boolean
  className?: string
} & VariantProps<typeof amountVariants>) {
  const exact = moneyParts(value, currency)
  const frac = Number(`${exact.integer.replace(/\s/g, '')}.${exact.fraction}`)
  const counted = useCountUp(Math.abs(frac), { enabled: animate })
  const p =
    animate && counted !== Math.abs(frac)
      ? moneyParts(`${exact.negative ? '-' : ''}${counted.toFixed(2)}`, currency)
      : exact
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
