import { cn } from '@fakturky/ui/lib/utils'
import { useId } from 'react'

/**
 * Tiny trend line for KPI cards. Decorative (the numbers next to it carry the meaning), so it is
 * hidden from assistive tech. The end point is a dot positioned in percent so it never distorts.
 */
export function Sparkline({
  values,
  className,
  tone = 'primary',
}: {
  values: number[]
  className?: string
  tone?: 'primary' | 'destructive' | 'muted'
}) {
  const gid = useId()
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const pad = 0.18
  const pts = values.map((v, i) => ({
    x: 3 + (i / (values.length - 1)) * 94,
    y: (1 - ((v - min) / span) * (1 - pad * 2) - pad) * 100,
  }))
  const line = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' ')
  const area = `${line} L100 100 L0 100 Z`
  const last = pts[pts.length - 1]
  const color =
    tone === 'destructive'
      ? 'var(--destructive)'
      : tone === 'muted'
        ? 'var(--muted-foreground)'
        : 'var(--primary)'
  return (
    <span aria-hidden className={cn('relative block h-10 w-full overflow-visible', className)}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="size-full overflow-visible">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.22} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gid})`} />
        <path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {last && (
        <span
          className="absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ left: `${last.x}%`, top: `${last.y}%`, backgroundColor: color }}
        />
      )}
    </span>
  )
}
