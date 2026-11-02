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
  return (e as Error).message || cs.common.error
}
