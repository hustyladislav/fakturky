export const PRAGUE_TZ = 'Europe/Prague'

export type IsoDate = string

const fmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: PRAGUE_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Today's calendar date in Europe/Prague as `YYYY-MM-DD`. */
export function todayPrague(now: Date = new Date()): IsoDate {
  return fmt.format(now)
}

function parseIso(date: IsoDate): { y: number; m: number; d: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!m) throw new Error(`Invalid ISO date: ${date}`)
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const check = new Date(Date.UTC(y, mo - 1, d))
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) {
    throw new Error(`Invalid ISO date: ${date}`)
  }
  return { y, m: mo, d }
}

export function isValidIsoDate(date: string): boolean {
  try {
    parseIso(date)
    return true
  } catch {
    return false
  }
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const { y, m, d } = parseIso(date)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

export const DUE_DAY_PRESETS = [7, 14, 30] as const
export const DEFAULT_DUE_DAYS = 14

export function dueDate(issueDate: IsoDate, dueDays: number = DEFAULT_DUE_DAYS): IsoDate {
  if (!Number.isInteger(dueDays) || dueDays < 0) throw new Error('dueDays must be a non-negative integer')
  return addDays(issueDate, dueDays)
}

/** Overdue: still unpaid and the due date is strictly before today (Europe/Prague). */
export function isOverdue(dueDateIso: IsoDate, today: IsoDate = todayPrague()): boolean {
  parseIso(dueDateIso)
  return dueDateIso < today
}

/** Whole days past due (0 when not overdue). */
export function daysOverdue(dueDateIso: IsoDate, today: IsoDate = todayPrague()): number {
  if (!isOverdue(dueDateIso, today)) return 0
  const a = parseIso(dueDateIso)
  const b = parseIso(today)
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000)
}

/** Czech short date `1. 11. 2026`. */
export function formatDateCs(date: IsoDate): string {
  const { y, m, d } = parseIso(date)
  return `${d}. ${m}. ${y}`
}

/** `01.11.2026` as used by ČNB. */
export function formatDateDotted(date: IsoDate): string {
  const { y, m, d } = parseIso(date)
  return `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${y}`
}

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export function isoWeekday(date: IsoDate): number {
  const { y, m, d } = parseIso(date)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() || 7
}

export function isWeekend(date: IsoDate): boolean {
  return isoWeekday(date) >= 6
}

/** How often a recurring invoice is issued. */
export type Frequency = 'monthly' | 'quarterly' | 'yearly'
const MONTHS: Record<Frequency, number> = { monthly: 1, quarterly: 3, yearly: 12 }

/** The occurrence after `from`, on `dayOfMonth` (clamped to the length of the target month). */
export function nextOccurrence(from: string, frequency: Frequency, dayOfMonth: number): string {
  const y = Number(from.slice(0, 4))
  const m = Number(from.slice(5, 7)) - 1 + MONTHS[frequency]
  const ty = y + Math.floor(m / 12)
  const tm = ((m % 12) + 12) % 12
  const last = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate()
  const day = Math.min(dayOfMonth, last)
  return `${ty}-${String(tm + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** First occurrence on or after `from` for the given day of month. */
export function firstOccurrence(from: string, dayOfMonth: number): string {
  const y = Number(from.slice(0, 4))
  const m = Number(from.slice(5, 7)) - 1
  const clamp = (yy: number, mm: number) =>
    Math.min(dayOfMonth, new Date(Date.UTC(yy, mm + 1, 0)).getUTCDate())
  const thisMonth = `${from.slice(0, 7)}-${String(clamp(y, m)).padStart(2, '0')}`
  if (thisMonth >= from) return thisMonth
  return nextOccurrence(thisMonth, 'monthly', dayOfMonth)
}

/** Inclusive calendar range, both ends `YYYY-MM-DD`. */
export interface DatePeriod {
  from: IsoDate
  to: IsoDate
}

export const PERIOD_PRESETS = ['thisMonth', 'lastMonth', 'thisQuarter', 'thisYear'] as const
export type PeriodPreset = (typeof PERIOD_PRESETS)[number]

const pad2 = (n: number) => String(n).padStart(2, '0')

function monthsRange(y: number, month: number, months = 1): DatePeriod {
  const end = new Date(Date.UTC(y, month - 1 + months, 0))
  return {
    from: `${y}-${pad2(month)}-01`,
    to: `${end.getUTCFullYear()}-${pad2(end.getUTCMonth() + 1)}-${pad2(end.getUTCDate())}`,
  }
}

/** Whole calendar periods around `today` (a Prague date); the end day is included. */
export function periodPreset(preset: PeriodPreset, today: IsoDate = todayPrague()): DatePeriod {
  const { y, m } = parseIso(today)
  switch (preset) {
    case 'thisMonth':
      return monthsRange(y, m)
    case 'lastMonth':
      return m === 1 ? monthsRange(y - 1, 12) : monthsRange(y, m - 1)
    case 'thisQuarter':
      return monthsRange(y, Math.floor((m - 1) / 3) * 3 + 1, 3)
    case 'thisYear':
      return monthsRange(y, 1, 12)
  }
}

/** File-name part for a period: `2026-10` for one whole month, otherwise the bounds that were given. */
export function periodFileLabel(from: IsoDate | undefined, to: IsoDate | undefined): string {
  if (from && to) {
    const month = monthsRange(Number(from.slice(0, 4)), Number(from.slice(5, 7)))
    return month.from === from && month.to === to ? from.slice(0, 7) : `${from}_${to}`
  }
  if (from) return `od-${from}`
  if (to) return `do-${to}`
  return ''
}

