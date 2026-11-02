import { BRAND } from '@fakturky/core/brand'
import { createFileRoute } from '@tanstack/react-router'
import { LegalPage, LegalSections } from '@/components/marketing/legal-page'
import { cs } from '@/i18n/cs'

export const Route = createFileRoute('/podminky')({
  head: () => ({ meta: [{ title: `${cs.legal.terms} — ${BRAND.name}` }] }),
  component: () => (
    <LegalPage title={cs.legal.terms} updated="1. 11. 2026" sections={cs.legal.termsSections}>
      <LegalSections sections={cs.legal.termsSections} />
    </LegalPage>
  ),
})
