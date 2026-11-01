import { cn } from 'cn'
import { moneyParts } from '../lib/money'

/** Czech money amount; the haléře are dimmed to 60 % in the UI (never on documents). */
function Money({
  amount,
  currency = 'CZK',
  className,
}: {
  amount: string
  currency?: string
  className?: string
}) {
  const p = moneyParts(amount, currency)
  return (
    <span className={cn('whitespace-nowrap tabular-nums', className)}>
      {p.negative && '−'}
      {p.integer}
      <span className="opacity-60">,{p.fraction}</span>
      {' '}
      {p.currency}
    </span>
  )
}

export { Money }
