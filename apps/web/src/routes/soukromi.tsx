import { BRAND } from '@fakturky/core/brand'
import { createFileRoute } from '@tanstack/react-router'
import { LegalPage, LegalSections } from '@/components/marketing/legal-page'
import { cs } from '@/i18n/cs'

export const Route = createFileRoute('/soukromi')({
  head: () => ({ meta: [{ title: `${cs.legal.privacy} — ${BRAND.name}` }] }),
  component: () => (
    <LegalPage title={cs.legal.privacy} updated="1. 11. 2026">
      <LegalSections sections={cs.legal.privacySections} />
    </LegalPage>
  ),
})
