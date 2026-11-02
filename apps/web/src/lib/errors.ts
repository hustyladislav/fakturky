import { cs } from '@/i18n/cs'

/** Czech message for an API error; field-level validation errors name what is missing. */
export function apiErrorMessage(e: unknown): string {
  const data = (e as { data?: { fields?: string[] } }).data
  if (data?.fields?.length) {
    const names = data.fields.map(
      (f) => cs.invoices.form.missingFields[f as keyof typeof cs.invoices.form.missingFields] ?? f,
    )
    return cs.invoices.form.missingCustomer(names)
  }
  return (e as Error).message || cs.common.error
}
