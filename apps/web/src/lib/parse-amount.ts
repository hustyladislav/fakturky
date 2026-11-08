/**
 * Parses a hand-entered amount: Czech formatting (spaces, NBSP, comma) is fine.
 * Returns the canonical `-?123.45` string, `null` when the field is empty, `'invalid'` otherwise.
 */
export function parseInputAmount(raw: string): string | null | 'invalid' {
  const cleaned = raw.replace(/[\s\u00a0\u202f]/g, '').replace(',', '.')
  if (cleaned === '') return null
  return /^-?\d+(\.\d{1,2})?$/.test(cleaned) ? cleaned : 'invalid'
}
