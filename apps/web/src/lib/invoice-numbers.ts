/** Czech input: "1 500,5" (space or NBSP thousands, comma decimal) -> "1500.5". Empty is "0". */
export const num = (v: string) => {
  const t = v.replace(/[\s  ]/g, '').replace(',', '.')
  return t === '' ? '0' : t
}

/** Strips trailing fraction zeros from a decimal string without going through floating point. */
export const trimDecimal = (v: string) => (v.includes('.') ? v.replace(/\.?0+$/, '') : v)

export const validNum = (v: string) => /^-?\d+(\.\d+)?$/.test(num(v))
