import { cs } from '@/i18n/cs'
import { ItemsTable } from './items-table'
import { Section } from './section'
import { Totals } from './totals'
import type { InvoiceDraft } from './use-invoice-draft'

/** The line items and what they add up to. */
export function ItemsSection({ draft }: { draft: InvoiceDraft }) {
  return (
    <Section title={cs.invoices.form.items}>
      <ItemsTable
        lines={draft.fields.lines}
        onChange={(lines) => draft.set({ lines })}
        vatPayer={draft.vatPayer}
        rowTotals={draft.rowTotals}
        currency={draft.fields.currency}
        newLine={draft.newLine}
      />
      <Totals draft={draft} />
    </Section>
  )
}
