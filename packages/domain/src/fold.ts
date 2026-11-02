const SPECIAL: Record<string, string> = { ł: 'l', đ: 'd', ø: 'o' }

/** Lowercase, accent-free form of a string (Czech, Slovak, Polish, German letters). */
export function foldText(s: string): string {
  return [...s.toLowerCase()]
    .map((c) => SPECIAL[c] ?? c.normalize('NFD').replace(/\p{M}/gu, ''))
    .join('')
}
