import { Skeleton } from '@fakturky/ui/components/skeleton'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useMemo } from 'react'
import { ErrorState } from '@/components/error-state'
import { InvoiceDetailView } from '@/components/invoice-detail/detail-view'
import { useInvoiceController } from '@/components/invoice-detail/use-invoice-controller'
import { cs } from '@/i18n/cs'
import { detailToSheet } from '@/lib/document-sheet'
import { pageHead, useDocumentTitle } from '@/lib/head'
import { orpc } from '@/lib/orpc'

export const Route = createFileRoute('/_app/faktury/$id/')({
  head: pageHead(cs.invoices.title),
  // `?zaplatit` opens the payment panel (⌘K "zaplatit 2026-0028").
  validateSearch: (s: Record<string, unknown>): { zaplatit?: true } => ({
    zaplatit: s.zaplatit === true || s.zaplatit === 'true' ? true : undefined,
  }),
  component: InvoiceDetail,
})

function InvoiceDetail() {
  const { id } = Route.useParams()
  const { zaplatit } = Route.useSearch()
  const q = useQuery(orpc.documents.get.queryOptions({ input: { id } }))
  const d = q.data
  useDocumentTitle(d?.number)
  const ctrl = useInvoiceController(id, d, !!zaplatit)
  const defaults = useQuery(orpc.documents.defaults.queryOptions({ input: {} }))

  // The paper needs the look (logo, accent, signature); a draft has no snapshots yet, so it also reads the
  // live profile, contact and bank account.
  const isDraft = d?.status === 'draft'
  const profile = useQuery({
    ...orpc.businessProfile.get.queryOptions({ input: {} }),
    enabled: isDraft,
  })
  const contact = useQuery({
    ...orpc.contacts.get.queryOptions({ input: { id: d?.contactId ?? '' } }),
    enabled: isDraft && !!d?.contactId,
  })
  const accounts = useQuery({
    ...orpc.bankAccounts.list.queryOptions({ input: {} }),
    enabled: isDraft,
  })
  const sheet = useMemo(
    () =>
      d
        ? detailToSheet(d, {
            profile: profile.data,
            contact: contact.data,
            accounts: accounts.data,
          })
        : null,
    [d, profile.data, contact.data, accounts.data],
  )

  if (q.isError) {
    // A missing invoice is final; anything else (offline, 5xx) is worth another try.
    const code = (q.error as { code?: string } | null)?.code
    if (code === 'NOT_FOUND' || code === 'BAD_REQUEST') {
      return <p className="text-muted-foreground">{cs.invoices.detail.notFound}</p>
    }
    return <ErrorState onRetry={() => q.refetch()} />
  }
  if (!d || !sheet) {
    return (
      <div className="mx-auto max-w-[1136px]" aria-busy="true">
        <Skeleton className="mb-6 h-9 w-56" />
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Skeleton className="h-[640px] rounded-[3px]" />
          <Skeleton className="h-[320px] rounded-xl" />
        </div>
      </div>
    )
  }

  return <InvoiceDetailView d={d} sheet={sheet} ctrl={ctrl} vatPayer={defaults.data?.vatPayer} />
}
