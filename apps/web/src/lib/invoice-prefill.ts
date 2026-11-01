/**
 * Hand-off from the assistant (`prefillInvoiceForm` client tool) to the new-invoice form: the tool stores a
 * draft here and navigates; the form takes it once when it seeds itself. In-memory on purpose — it never
 * outlives the page and is never sent anywhere.
 */
export type InvoicePrefill = {
  contactId?: string
  dueDate?: string
  lines: { description: string; quantity: string; unitPrice: string; vatRate?: string }[]
}

let pending: InvoicePrefill | null = null
const listeners = new Set<() => void>()

export function setInvoicePrefill(prefill: InvoicePrefill | null) {
  pending = prefill
  if (prefill) for (const notify of listeners) notify()
}

/** Lets an already-open form pick up a prefill that arrives without a navigation. */
export function onInvoicePrefill(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function takeInvoicePrefill(): InvoicePrefill | null {
  const value = pending
  pending = null
  return value
}
