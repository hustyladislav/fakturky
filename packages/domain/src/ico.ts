/** Czech IČO: 8 digits, last is a mod-11 check digit (weights 8..2). */
export function isValidIco(value: string): boolean {
  const ico = normalizeIco(value)
  if (!/^\d{8}$/.test(ico)) return false
  let sum = 0
  for (let i = 0; i < 7; i++) sum += Number(ico[i]) * (8 - i)
  const check = (11 - (sum % 11)) % 10
  return check === Number(ico[7])
}

/** Strips whitespace and left-pads shorter numeric IČOs to 8 digits. */
export function normalizeIco(value: string): string {
  const v = value.replace(/\s/g, '')
  return /^\d{1,8}$/.test(v) ? v.padStart(8, '0') : v
}
