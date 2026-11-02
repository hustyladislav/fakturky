/** Date helpers on `YYYY-MM-DD` strings (the API's date format), always in the viewer's local calendar. */

export function toIsoDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** Parses `YYYY-MM-DD` (or a Date) to a local-midnight Date. Returns null if invalid. */
export function parseIsoDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : startOfDay(value)
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(d.getTime()) ? null : d
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days)
}

/** Whole calendar days from `from` to `to` (positive when `to` is later). DST-safe. */
export function diffDays(to: Date, from: Date): number {
  const utc = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  return Math.round((utc(to) - utc(from)) / 86_400_000)
}

/** `28. 10. 2026` (Czech numeric date). */
export function formatDate(d: Date): string {
  return new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' })
    .format(d)
    .replace(/ /g, ' ')
}

/** Czech plural for days: 1 den, 2-4 dny, 5+ dní. */
export function pluralDays(n: number): string {
  const abs = Math.abs(n)
  return `${abs} ${abs === 1 ? 'den' : abs >= 2 && abs <= 4 ? 'dny' : 'dní'}`
}

/** "dnes", "včera", "zítra", "za 5 dní", "před 3 dny", "před 2 měsíci" … */
export function relativeDayLabel(days: number): string {
  const rtf = new Intl.RelativeTimeFormat('cs', { numeric: 'auto' })
  const abs = Math.abs(days)
  if (abs < 60) return rtf.format(days, 'day')
  if (abs < 365) return rtf.format(Math.round(days / 30), 'month')
  return rtf.format(Math.round(days / 365), 'year')
}
