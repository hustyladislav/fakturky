import { isValidIsoDate } from '@fakturky/domain/dates'
import {
  navigateTool,
  openDocumentTool,
  prefillInvoiceFormTool,
} from '@/components/assistant/agent-client-tools'
import { setInvoicePrefill } from '@/lib/invoice-prefill'

type Navigate = (options: {
  to: string
  params?: Record<string, string>
  search?: unknown
}) => unknown

/** Browser-side implementations of the tools declared in `./agent-client-tools`. */
export function createClientTools(navigate: Navigate) {
  return [
    navigateTool.client(async ({ to, filter, q }) => {
      if (to === '/faktury') {
        await navigate({
          to,
          search: { filter: filter ?? 'all', ...(q ? { q } : {}) },
        })
      } else {
        await navigate({ to })
      }
      return { ok: true }
    }),
    openDocumentTool.client(async ({ id }) => {
      await navigate({ to: '/faktury/$id', params: { id } })
      return { ok: true }
    }),
    prefillInvoiceFormTool.client(async ({ contactId, lines, dueDate }) => {
      setInvoicePrefill({
        contactId,
        dueDate: dueDate && isValidIsoDate(dueDate) ? dueDate : undefined,
        lines: (lines ?? []).map((l) => ({ ...l, quantity: l.quantity ?? '1' })),
      })
      await navigate({ to: '/faktury/nova' })
      return { ok: true }
    }),
  ]
}
