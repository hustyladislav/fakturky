import { formatDateCs } from '@fakturky/domain/dates'
import { PageHeader } from '@fakturky/ui/components/page-header'
import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { ActionButton, MoreMenu } from '@/components/invoice-detail/action-controls'
import { planActions } from '@/components/invoice-detail/actions'
import { InvoiceDialogs } from '@/components/invoice-detail/dialogs'
import { DocumentPaper } from '@/components/invoice-detail/document-paper'
import { PayPanel, SendPanel } from '@/components/invoice-detail/panels'
import { PaymentSection } from '@/components/invoice-detail/payment'
import { PublicLinkSection, RelatedDocs } from '@/components/invoice-detail/related'
import { modeOf, Summary } from '@/components/invoice-detail/summary'
import { Timeline } from '@/components/invoice-detail/timeline'
import type { InvoiceController } from '@/components/invoice-detail/use-invoice-controller'
import { cs } from '@/i18n/cs'
import type { DocumentDetail, detailToSheet } from '@/lib/document-sheet'

type DocumentSheet = ReturnType<typeof detailToSheet>

const t = cs.invoices.detail
const SECTION = 'hairline pt-5'

/**
 * The document on the left, a flat rail on the right: amount, status and due date, one primary action,
 * quiet secondary ones, then payment, related documents, history and the public link as hairline blocks.
 * Below `lg` the rail is `display: contents`, so its parts and the paper reorder into one phone column
 * with the primary action pinned above the tab bar.
 */
export function InvoiceDetailView({
  d,
  sheet,
  ctrl,
  vatPayer,
}: {
  d: DocumentDetail
  sheet: DocumentSheet
  ctrl: InvoiceController
  vatPayer: boolean | undefined
}) {
  const [docOpen, setDocOpen] = useState(false)
  const reached = d.activity.some((a) => ['sent', 'reminded', 'viewed'].includes(a.action))
  const plan = planActions({
    type: d.type,
    status: d.status,
    displayStatus: d.displayStatus,
    total: d.total,
    hasPublicLink: !!ctrl.publicUrl,
    reached,
    related: d.related,
    vatPayer,
  })
  const primary = <ActionButton action={plan.primary} ctrl={ctrl} plan={plan} tone="primary" />

  return (
    <div className="mx-auto max-w-[1136px]">
      <Link
        to="/faktury"
        className="mb-3 inline-flex items-center gap-1 text-muted-foreground text-sm hover:text-foreground pointer-coarse:min-h-11"
      >
        <ArrowLeft className="size-3.5" aria-hidden /> {t.back}
      </Link>
      <PageHeader
        eyebrow={cs.invoices.type[d.type as keyof typeof cs.invoices.type]}
        title={d.number ?? cs.invoices.draftNumber}
        subtitle={
          <>
            {d.customerName ?? '—'}
            {d.issueDate ? ` · ${formatDateCs(d.issueDate)}` : ''}
          </>
        }
      />

      <div className="flex flex-col gap-6 pb-28 md:pb-8 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-x-12">
        <aside
          aria-label={t.hero[modeOf(d)]}
          className="contents lg:col-start-2 lg:row-start-1 lg:flex lg:flex-col lg:gap-6"
        >
          <div className="order-1">
            <Summary d={d}>
              <div className="hidden md:block">{primary}</div>
              <div className="grid grid-cols-2 gap-2 [&>*:last-child:nth-child(odd)]:col-span-2">
                {plan.secondary.map((a) => (
                  <ActionButton key={a} action={a} ctrl={ctrl} plan={plan} tone="quiet" />
                ))}
                <MoreMenu actions={plan.more} ctrl={ctrl} />
              </div>
            </Summary>
            {ctrl.panel === 'send' && <SendPanel d={d} ctrl={ctrl} />}
            {ctrl.panel === 'pay' && <PayPanel d={d} ctrl={ctrl} />}
          </div>
          <PaymentSection d={d} className={`order-2 ${SECTION}`} />
          <RelatedDocs d={d} className={`order-4 ${SECTION}`} />
          <Timeline d={d} className={`order-4 ${SECTION}`} />
          {ctrl.publicUrl && (
            <PublicLinkSection
              url={ctrl.publicUrl}
              rotating={!!ctrl.pending.rotate}
              onRotate={() => ctrl.setDialog('rotate')}
              className={`order-4 ${SECTION}`}
            />
          )}
        </aside>

        <DocumentPaper
          className="order-3 min-w-0 lg:col-start-1 lg:row-start-1"
          doc={sheet.doc}
          qr={sheet.qr}
          open={docOpen}
          onToggle={() => setDocOpen((v) => !v)}
        />
      </div>

      <InvoiceDialogs d={d} ctrl={ctrl} />

      {/* Phones: the primary action sits above the tab bar. Hidden while the pay/send panel is open:
          its own confirm button is the action then. */}
      {!ctrl.panel && (
        <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 border-t bg-background/95 p-3 backdrop-blur md:hidden">
          {primary}
        </div>
      )}
    </div>
  )
}
