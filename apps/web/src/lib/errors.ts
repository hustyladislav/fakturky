import { formatNumber } from '@fakturky/domain/money'
import { cs } from '@/i18n/cs'

/** Czech message for an API error; field-level validation errors name what is missing. */
export function apiErrorMessage(e: unknown): string {
  const fields = (e as { data?: { fields?: string[] } }).data?.fields
  if (fields?.length) {
    const label = (f: string) =>
      cs.invoices.form.missingFields[f as keyof typeof cs.invoices.form.missingFields] ?? f
    const customer = fields.filter((f) => f.startsWith('customer.')).map(label)
    const lines = fields.filter((f) => f.startsWith('line.')).map(label)
    return [
      customer.length ? cs.invoices.form.missingCustomer(customer) : '',
      lines.length ? cs.invoices.form.missingLines(lines) : '',
    ]
      .filter(Boolean)
      .join(' ')
  }
  return serverErrorMessage((e as Error).message)
}

/** The API speaks English for REST and MCP clients; a person here must never read that. */
export function serverErrorMessage(message: string | undefined): string {
  if (!message) return cs.common.error
  const known = cs.serverErrors[message]
  if (known) return known
  const allocations = message.match(/^The allocations must .*\((.+)\)$/)
  if (allocations?.[1]) return cs.serverErrorsDynamic.allocations(formatNumber(allocations[1]))
  const credit = message.match(/^The credited amount exceeds .*\((.+)\)$/)
  if (credit?.[1]) return cs.serverErrorsDynamic.creditExceeded(formatNumber(credit[1]))
  if (message.startsWith('Invalid pattern, stray brace')) return cs.serverErrorsDynamic.strayBrace
  return cs.common.error
}
