import { NativeSelect } from '@fakturky/ui/components/native-select'
import { Link } from '@tanstack/react-router'
import { cs } from '@/i18n/cs'
import { CustomerCard } from './customer-card'
import { Section } from './section'
import type { InvoiceDraft } from './use-invoice-draft'

const t = cs.invoices.form

/** Document kind, the customer (the one thing to fill first) and who is billing. */
export function PartiesSection({ draft, isEdit }: { draft: InvoiceDraft; isEdit: boolean }) {
  const { fields, set, supplier, type } = draft
  return (
    <>
      <Section>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          {isEdit ? (
            <span className="text-xl">{cs.invoices.type[type]}</span>
          ) : (
            <NativeSelect
              aria-label={t.documentType}
              className="w-auto min-w-52"
              value={fields.docType}
              onChange={(e) => set({ docType: e.target.value as 'invoice' | 'proforma' })}
            >
              <option value="invoice">{cs.invoices.type.invoice}</option>
              <option value="proforma">{cs.invoices.type.proforma}</option>
            </NativeSelect>
          )}
          <p className="text-muted-foreground text-sm">
            {t.number}: {t.numberAuto}
          </p>
        </div>
        {!isEdit && fields.docType === 'proforma' && (
          <p className="mt-3 text-muted-foreground text-sm">{t.proformaHint}</p>
        )}
      </Section>

      <Section title={t.customer}>
        <CustomerCard
          value={fields.customer}
          details={draft.customerDetails}
          autoFocus={!isEdit}
          onChange={(c) => {
            set({ customer: c })
            // Next thing to type is what you bill: land on the first description.
            if (c)
              setTimeout(() => document.querySelector<HTMLElement>('[data-line-desc]')?.focus(), 0)
          }}
        />
        {draft.euReverseDomestic && (
          <p role="alert" className="mt-3 text-destructive text-sm">
            {cs.contacts.euReverseChargeDomestic}
          </p>
        )}
        {draft.issueError && (
          <p role="alert" className="mt-3 text-destructive text-sm">
            {draft.issueError}{' '}
            <Link to="/kontakty" className="underline">
              {cs.nav.contacts}
            </Link>
          </p>
        )}
        <p className="mt-4 text-muted-foreground text-sm">
          {supplier ? (
            <>
              {t.supplier}: <span className="text-foreground">{supplier.legalName}</span>
              <span className="max-sm:hidden">{supplier.ico && ` · IČO ${supplier.ico}`}</span>
              {' · '}
              <Link to="/nastaveni" className="underline underline-offset-2 hover:text-foreground">
                {t.supplierEdit}
              </Link>
            </>
          ) : (
            ' '
          )}
        </p>
      </Section>
    </>
  )
}
