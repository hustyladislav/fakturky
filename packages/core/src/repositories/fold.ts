import { type SQL, sql } from 'drizzle-orm'

const ACCENTED = 'áàâäãåāąćčďđéěèêëēęíìîïīĺľłńňñóòôöõőøŕřśšťúůùûüűýÿźžż'
const SPECIAL: Record<string, string> = { ł: 'l', đ: 'd', ø: 'o' }

/** Lowercase, accent-free form of a string (Czech, Slovak, Polish, German letters). */
export function foldText(s: string): string {
  return [...s.toLowerCase()]
    .map((c) => SPECIAL[c] ?? c.normalize('NFD').replace(/\p{M}/gu, ''))
    .join('')
}

const FROM = ACCENTED + ACCENTED.toUpperCase()
const TO = foldText(ACCENTED) + foldText(ACCENTED)

/**
 * SQL twin of `foldText`. `translate` + `lower` instead of the `unaccent` extension: immutable, needs no
 * extension on Neon or PGlite and does not depend on the database locale (so it can back an expression index).
 */
export function foldSql(expr: SQL): SQL {
  return sql`lower(translate(coalesce(${expr}, ''), ${sql.raw(`'${FROM}'`)}, ${sql.raw(`'${TO}'`)}))`
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, '\\$&')

/** `%folded%` LIKE pattern for a user-typed term. */
export const foldedPattern = (term: string) => `%${escapeLike(foldText(term))}%`

/** Plain decimal from "26 015", "26015,50" or "26015.5"; null when the term is not an amount. */
export function amountTerm(term: string): string | null {
  const t = term.replace(/[\s  ]/g, '')
  if (!/^\d+([.,]\d{1,2})?$/.test(t)) return null
  return t.replace(',', '.')
}

/** Matches when every whitespace-separated word occurs in at least one of the folded columns. */
export function foldedWordsMatch(term: string, columns: SQL[]): SQL | undefined {
  const words = term.split(/\s+/).filter(Boolean)
  if (words.length === 0) return undefined
  const perWord = words.map((w) => {
    const pattern = foldedPattern(w)
    return sql`(${sql.join(
      columns.map((c) => sql`${foldSql(c)} like ${pattern} escape '\\'`),
      sql` or `,
    )})`
  })
  return sql`(${sql.join(perWord, sql` and `)})`
}
