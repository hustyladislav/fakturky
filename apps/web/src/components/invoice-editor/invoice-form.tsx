import { Button } from '@fakturky/ui/components/button'
import { PageHeader } from '@fakturky/ui/components/page-header'
import { Link } from '@tanstack/react-router'
import { X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cs } from '@/i18n/cs'
import { ActionBar } from './action-bar'
import { ItemsSection } from './items-section'
import { MoreOptions } from './more-options'
import { PartiesSection } from './parties'
import { PreviewPane, PreviewSheet, useIsWide } from './preview'
import { TermsSection } from './terms-section'
import { useInvoiceDraft } from './use-invoice-draft'

const t = cs.invoices.form
const REGISTRY_DISMISS_KEY = 'registryNoteBannerDismissed'

/** The "register entry missing" hint, dismissible for good (desktop only; a phone has no room for it). */
function RegistryNote() {
  const [dismissed, setDismissed] = useState(false)
  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(REGISTRY_DISMISS_KEY) === '1')
    } catch {
      /* storage unavailable: the banner just stays */
    }
  }, [])
  if (dismissed) return null
  return (
    <div className="mb-4 flex items-start gap-2 border-y py-3 text-muted-foreground text-sm max-sm:hidden">
      <p className="min-w-0 flex-1">
        {t.registryNoteMissing}{' '}
        <Link to="/nastaveni" className="underline">
          {cs.nav.settings}
        </Link>
      </p>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={t.registryNoteDismiss}
        className="-my-1 -mr-1 shrink-0"
        onClick={() => {
          setDismissed(true)
          try {
            localStorage.setItem(REGISTRY_DISMISS_KEY, '1')
          } catch {
            /* storage unavailable */
          }
        }}
      >
        <X />
      </Button>
    </div>
  )
}

/** New invoice, or the editor of a stored draft (`id`): a flat document next to its live preview. */
export function InvoiceForm({ id }: { id?: string }) {
  const draft = useInvoiceDraft(id)
  const [previewOpen, setPreviewOpen] = useState(false)
  const wide = useIsWide()
  const { defaults } = draft

  return (
    <div className="mx-auto max-w-[1136px] pb-6">
      <PageHeader
        eyebrow={cs.invoices.type[draft.type]}
        title={id ? t.titleEdit : t.titleNew}
        // A non-breaking space keeps the line, so the form does not jump when "unsaved" appears.
        subtitle={draft.dirty ? t.unsaved : draft.draftId ? t.savedState : ' '}
        className="mb-5"
      />
      {defaults && !defaults.hasProfile && (
        <p className="mb-4 rounded-lg border border-warning/50 bg-warning/14 p-3 text-foreground text-sm">
          {t.needProfile}{' '}
          <Link to="/nastaveni" className="underline">
            {cs.nav.settings}
          </Link>
        </p>
      )}
      {defaults?.hasProfile && defaults.registryNoteMissing && <RegistryNote />}

      <div className="grid items-start gap-12 xl:grid-cols-[minmax(0,1fr)_minmax(340px,420px)]">
        <section className="min-w-0" aria-label={t.documentHeading}>
          <PartiesSection draft={draft} isEdit={!!id} />
          <ItemsSection draft={draft} />
          <TermsSection draft={draft} />
          <MoreOptions draft={draft} isEdit={!!id} />
        </section>
        {wide && <PreviewPane doc={draft.sheetDoc} />}
      </div>

      <ActionBar draft={draft} onPreview={() => setPreviewOpen(true)} />
      {!wide && (
        <PreviewSheet doc={draft.sheetDoc} open={previewOpen} onOpenChange={setPreviewOpen} />
      )}
    </div>
  )
}
