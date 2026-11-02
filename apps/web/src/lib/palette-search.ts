import { foldText } from '@fakturky/domain/fold'

/** Recent documents and contacts fetched once (and prefetched by the shell); typed queries filter them locally first. */
export const PALETTE_POOL = { query: '', limit: 50 } as const

/**
 * How well `query` matches `text`: higher is better, -1 is no match. Case- and diacritics-insensitive;
 * every word of the query must match. Substring beats word-start beats in-order letters (typo-tolerant).
 */
export function fuzzyScore(text: string, query: string): number {
  const t = foldText(text)
  const words = foldText(query).split(/\s+/).filter(Boolean)
  if (words.length === 0) return 0
  let total = 0
  for (const w of words) {
    const at = t.indexOf(w)
    if (at >= 0) {
      const wordStart = at === 0 || /[\s.,/-]/.test(t.charAt(at - 1))
      total += wordStart ? 100 - Math.min(at, 50) : 60 - Math.min(at, 30)
      continue
    }
    if (w.length < 3) return -1
    let from = 0
    let gaps = 0
    for (const ch of w) {
      const i = t.indexOf(ch, from)
      if (i < 0) return -1
      gaps += i - from
      from = i + 1
    }
    total += Math.max(5, 40 - gaps * 4)
  }
  return total / words.length
}

export type Intent = { kind: 'invoice-for'; name: string } | { kind: 'mark-paid'; number: string }

const INVOICE_FOR =
  /^(?:vystav\w*\s+)?(?:nov\w+\s+)?faktur\w*\s+(?:pro|na|klient\w*|zakaznik\w*|odberatel\w*)\s+(.+)$/
const MARK_PAID = /^(?:zaplat\w*|uhrad\w*|zaplac\w*|oznac\w*(?:\s+jako)?\s+zaplacen\w*)\s+(\S+)$/

/** Parameterized commands recognised in the query: "vystav fakturu pro Lípa", "zaplatit 2026-0028". */
export function parseIntent(query: string): Intent | null {
  const q = foldText(query).trim().replace(/\s+/g, ' ')
  const inv = INVOICE_FOR.exec(q)
  if (inv?.[1]) return { kind: 'invoice-for', name: inv[1] }
  const pay = MARK_PAID.exec(q)
  if (pay?.[1]) return { kind: 'mark-paid', number: pay[1] }
  return null
}

/** The text the server should search for: the intent's argument, or the whole query. */
export function searchTerm(query: string): string {
  const intent = parseIntent(query)
  if (intent?.kind === 'invoice-for') return intent.name
  if (intent?.kind === 'mark-paid') return intent.number
  return query.trim()
}
