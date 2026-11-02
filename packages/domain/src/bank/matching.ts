import { Decimal } from '../money.ts'
import { normalizeHeader } from './text.ts'

/** The parts of a bank transaction that pairing looks at. */
export type MatchTransaction = {
  amount: string
  currency: string
  variableSymbol: string | null
  counterpartyName: string | null
  message: string | null
}

/** An open (issued, not fully paid) document a payment could belong to. */
export type MatchDocument = {
  id: string
  number: string | null
  variableSymbol: string | null
  currency: string
  /** Total minus payments so far (decimal string). */
  remaining: string
  customerName: string | null
}

export type MatchReason = 'variable_symbol' | 'reference_in_message' | 'amount' | 'name'

export type MatchSuggestion = { document: MatchDocument; score: number; reasons: MatchReason[] }

const stripZeros = (s: string) => s.replace(/^0+(?=\d)/, '')

/** A payment of exactly this amount settles the document (half a haléř of slack for rounding). */
const sameAmount = (a: Decimal, b: Decimal) => a.minus(b).abs().lt('0.005')

/**
 * The one open document whose variable symbol equals the payment's, in the same currency. This is the only
 * rule that is safe to apply without asking: a VS is the payer's explicit reference. Ambiguity (two open
 * documents with the same VS) yields null and the payment is left for a human.
 */
export function findByVariableSymbol(
  tx: MatchTransaction,
  docs: MatchDocument[],
): MatchDocument | null {
  if (!tx.variableSymbol || new Decimal(tx.amount).lte(0)) return null
  const vs = stripZeros(tx.variableSymbol)
  const hits = docs.filter(
    (d) =>
      d.variableSymbol !== null &&
      stripZeros(d.variableSymbol) === vs &&
      d.currency === tx.currency &&
      new Decimal(d.remaining).gt(0),
  )
  return hits.length === 1 ? (hits[0] as MatchDocument) : null
}

const STOP = new Set([
  'sro',
  'as',
  'spol',
  'ks',
  'vos',
  'se',
  'zs',
  'ltd',
  'gmbh',
  'inc',
  'llc',
  'ing',
  'mgr',
  'bc',
  'mudr',
  'judr',
  'phd',
  'dis',
  'cz',
  's',
  'r',
  'o',
  'a',
])

function nameTokens(name: string): Set<string> {
  const words = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 0 && !STOP.has(w))
  return new Set(words)
}

/** 0..1 similarity of two party names, tolerant of word order, legal suffixes and diacritics. */
export function nameSimilarity(a: string | null, b: string | null): number {
  if (!a || !b) return 0
  const x = nameTokens(a)
  const y = nameTokens(b)
  if (x.size === 0 || y.size === 0) return 0
  let common = 0
  for (const t of x) if (y.has(t)) common++
  const containment = common / Math.min(x.size, y.size)
  const jaccard = common / (x.size + y.size - common)
  return (containment + jaccard) / 2
}

/** Minimum score for a suggestion to be shown. */
export const SUGGESTION_THRESHOLD = 50

/**
 * Ranks open documents for a payment that could not be paired by variable symbol. Signals: the payer wrote the
 * VS or the invoice number into the message, the amount equals the open balance, the payer's name resembles the
 * customer. Suggestions are never applied automatically.
 */
export function suggestMatches(
  tx: MatchTransaction,
  docs: MatchDocument[],
  limit = 3,
): MatchSuggestion[] {
  const amount = new Decimal(tx.amount)
  if (amount.lte(0)) return []
  const message = tx.message ? normalizeHeader(tx.message) : ''
  const messageTokens = new Set(
    (tx.message ?? '')
      .split(/[^A-Za-z0-9]+/)
      .filter(Boolean)
      .map(stripZeros),
  )
  const out: MatchSuggestion[] = []
  for (const doc of docs) {
    if (doc.currency !== tx.currency) continue
    const remaining = new Decimal(doc.remaining)
    if (remaining.lte(0)) continue
    let score = 0
    const reasons: MatchReason[] = []
    if (
      tx.variableSymbol &&
      doc.variableSymbol &&
      stripZeros(tx.variableSymbol) === stripZeros(doc.variableSymbol)
    ) {
      score += 70
      reasons.push('variable_symbol')
    } else {
      const vsInMessage =
        doc.variableSymbol && doc.variableSymbol.length >= 4
          ? messageTokens.has(stripZeros(doc.variableSymbol))
          : false
      const numberKey = doc.number ? normalizeHeader(doc.number) : ''
      const numberInMessage = numberKey.length >= 5 && message.includes(numberKey)
      if (vsInMessage || numberInMessage) {
        score += 55
        reasons.push('reference_in_message')
      }
    }
    if (sameAmount(amount, remaining)) {
      score += 40
      reasons.push('amount')
    }
    if (nameSimilarity(tx.counterpartyName, doc.customerName) >= 0.5) {
      score += 25
      reasons.push('name')
    }
    if (score >= SUGGESTION_THRESHOLD) out.push({ document: doc, score, reasons })
  }
  return out.sort((p, q) => q.score - p.score).slice(0, limit)
}
