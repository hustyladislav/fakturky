import { BRAND } from '@fakturky/core/brand'
import { partyFromSnapshot } from '@fakturky/core/export'
import { InvoiceSheet, type InvoiceSheetDraft } from '@fakturky/pdf/html'
import { useMemo } from 'react'
import { cs } from '@/i18n/cs'
import { supplierSnapshot } from '@/lib/document-sheet'

type Profile = Parameters<typeof supplierSnapshot>[0]

/** A small sample invoice wearing the look that is being edited (colour, logo, signature, brand line). */
export function AppearancePreview({
  accent,
  logo,
  signature,
  showBrand,
  profile,
}: {
  accent: string
  logo: string | null
  signature: string | null
  showBrand: boolean
  profile: Profile
}) {
  const doc = useMemo<InvoiceSheetDraft>(
    () => ({
      type: 'invoice',
      language: 'cs',
      number: '2026-0001',
      vatPayer: false,
      issueDate: '2026-11-02',
      supplier: partyFromSnapshot(supplierSnapshot(profile)),
      customer: { name: cs.appearance.sampleCustomer, street: 'Na Příkopě 22', city: 'Praha 1' },
      lines: [
        { description: cs.appearance.sampleLine1, quantity: '1', unitPrice: '12000' },
        { description: cs.appearance.sampleLine2, quantity: '3', unit: 'h', unitPrice: '1500' },
      ],
      payment: { method: 'bank_transfer', dueDate: '2026-11-16' },
      brandName: BRAND.name,
      showBrand,
      accentColor: accent,
      ...(logo ? { logo } : {}),
      ...(signature ? { signature } : {}),
    }),
    [accent, logo, signature, showBrand, profile],
  )
  return (
    <figure className="m-0" data-testid="appearance-preview">
      <figcaption className="label-caps mb-2">{cs.appearance.preview}</figcaption>
      <div className="overflow-hidden rounded-[3px] shadow-[var(--shadow-sheet)]">
        <InvoiceSheet doc={doc} qr={null} density="compact" decorative headingLevel={3} />
      </div>
    </figure>
  )
}
