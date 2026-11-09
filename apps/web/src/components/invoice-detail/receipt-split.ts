import { parseDecimal, toFixed } from '@fakturky/domain/money'
import { parseInputAmount } from '@/lib/parse-amount'

/** Divides a received advance over 21 % and 12 %; `null` until the 12 % part is a usable amount. */
export function splitReceipt(
  received: string,
  reducedInput: string,
): { standard: string; reduced: string } | null {
  const parsed = parseInputAmount(reducedInput)
  if (parsed === null || parsed === 'invalid') return null
  const reduced = parseDecimal(parsed)
  const standard = parseDecimal(received).minus(reduced)
  if (reduced.lte(0) || standard.lte(0)) return null
  return { standard: toFixed(standard, 2), reduced: toFixed(reduced, 2) }
}
