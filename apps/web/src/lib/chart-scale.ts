/** Axis maths for the dashboard chart: "nice" ticks and compact Czech labels. */

/** Smallest "nice" step (1, 2, 2.5, 5 × 10ⁿ) so that `max` fits in at most `ticks` steps. */
export function niceStep(max: number, ticks = 4): number {
  if (max <= 0) return 1
  const raw = max / ticks
  const pow = 10 ** Math.floor(Math.log10(raw))
  for (const m of [1, 2, 2.5, 5, 10]) {
    if (m * pow >= raw) return m * pow
  }
  return 10 * pow
}

/** Gridline values 0, step, 2·step … up to the first value ≥ max. */
export function niceTicks(max: number, ticks = 4): number[] {
  const step = niceStep(max, ticks)
  const out = [0]
  while ((out.at(-1) ?? 0) < max) out.push((out.at(-1) ?? 0) + step)
  return out
}

/** 0 → "0", 50 000 → "50 tis.", 2 500 000 → "2,5 mil.". */
export function compactCz(value: number, labels = { thousand: 'tis.', million: 'mil.' }): string {
  const abs = Math.abs(value)
  const fmt = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',')
  if (abs >= 1_000_000) return `${fmt(value / 1_000_000)} ${labels.million}`
  if (abs >= 1_000) return `${fmt(value / 1_000)} ${labels.thousand}`
  return fmt(value)
}

/** Relative change in percent, rounded; null when there is no base to compare with. */
export function deltaPercent(current: number, previous: number): number | null {
  if (previous === 0) return null
  return Math.round(((current - previous) / Math.abs(previous)) * 100)
}
