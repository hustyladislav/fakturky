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
