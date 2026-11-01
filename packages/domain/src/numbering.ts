export type NumberingReset = 'yearly' | 'monthly' | 'never'

export interface NumberPatternToken {
  type: 'literal' | 'year4' | 'year2' | 'month' | 'counter'
  /** Literal text, or counter width. */
  value?: string
  width?: number
}

const TOKEN_RE = /\{(YYYY|YY|MM|N+)\}/g

/** Parses `{YYYY}-{NNNN}` into tokens. Throws if there is no counter token or braces are stray. */
export function parseNumberPattern(pattern: string): NumberPatternToken[] {
  const tokens: NumberPatternToken[] = []
  let last = 0
  let counters = 0
  for (const m of pattern.matchAll(TOKEN_RE)) {
    const idx = m.index ?? 0
    if (idx > last) tokens.push({ type: 'literal', value: pattern.slice(last, idx) })
    const t = m[1] as string
    if (t === 'YYYY') tokens.push({ type: 'year4' })
    else if (t === 'YY') tokens.push({ type: 'year2' })
    else if (t === 'MM') tokens.push({ type: 'month' })
    else {
      counters++
      tokens.push({ type: 'counter', width: t.length })
    }
    last = idx + m[0].length
  }
  if (last < pattern.length) tokens.push({ type: 'literal', value: pattern.slice(last) })
  if (counters !== 1) throw new Error('Pattern must contain exactly one counter token like {NNNN}')
  for (const t of tokens) {
    if (t.type === 'literal' && /[{}]/.test(t.value ?? '')) {
      throw new Error(`Invalid pattern, stray brace: ${pattern}`)
    }
  }
  return tokens
}

export function isValidNumberPattern(pattern: string): boolean {
  try {
    parseNumberPattern(pattern)
    return true
  } catch {
    return false
  }
}

export interface NumberDate {
  year: number
  /** 1–12 */
  month: number
}

export function formatNumber(pattern: string, counter: number, date: NumberDate): string {
  if (!Number.isInteger(counter) || counter < 0) throw new Error('counter must be a non-negative integer')
  return parseNumberPattern(pattern)
    .map((t) => {
      switch (t.type) {
        case 'literal':
          return t.value
        case 'year4':
          return String(date.year).padStart(4, '0')
        case 'year2':
          return String(date.year % 100).padStart(2, '0')
        case 'month':
          return String(date.month).padStart(2, '0')
        case 'counter':
          return String(counter).padStart(t.width ?? 1, '0')
      }
    })
    .join('')
}

/** Key identifying the counter bucket a document belongs to. */
export function periodKey(reset: NumberingReset, date: NumberDate): string {
  switch (reset) {
    case 'yearly':
      return String(date.year)
    case 'monthly':
      return `${date.year}-${String(date.month).padStart(2, '0')}`
    case 'never':
      return 'all'
  }
}

/** Default variable symbol: digits of the document number, at most 10 (keeps the trailing digits). */
export function variableSymbolFromNumber(number: string): string {
  const digits = number.replace(/\D/g, '')
  return digits.length > 10 ? digits.slice(digits.length - 10) : digits
}

export const DEFAULT_NUMBER_PATTERNS = {
  invoice: '{YYYY}-{NNNN}',
  proforma: 'Z{YYYY}-{NNNN}',
  credit_note: 'D{YYYY}-{NNNN}',
  payment_receipt: 'P{YYYY}-{NNNN}',
  estimate: 'N{YYYY}-{NNNN}',
} as const

/**
 * Inverse of {@link formatNumber}: extracts the counter (and year/month when the pattern has them)
 * from a document number, or null when the number does not follow the pattern.
 */
export function parseNumber(
  pattern: string,
  number: string,
): { counter: number; year?: number; month?: number } | null {
  const tokens = parseNumberPattern(pattern)
  const source = tokens
    .map((t) => {
      switch (t.type) {
        case 'literal':
          return (t.value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        case 'year4':
          return '(?<y4>\\d{4})'
        case 'year2':
          return '(?<y2>\\d{2})'
        case 'month':
          return '(?<m>\\d{2})'
        case 'counter':
          return '(?<n>\\d+)'
      }
    })
    .join('')
  const g = new RegExp(`^${source}$`).exec(number)?.groups
  if (!g?.n) return null
  const year = g.y4 ? Number(g.y4) : g.y2 ? 2000 + Number(g.y2) : undefined
  return { counter: Number(g.n), year, month: g.m ? Number(g.m) : undefined }
}
