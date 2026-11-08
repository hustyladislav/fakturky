import { Button } from '@fakturky/ui/components/button'
import { EmptyState } from '@fakturky/ui/components/empty-state'
import { Check, Upload } from 'lucide-react'
import { cs } from '@/i18n/cs'

const t = cs.bank

export type BankFilter = 'unmatched' | 'matched' | 'ignored' | 'outgoing'

/** The right empty state for an empty list: no account, no payments at all, a cleared tab or a search miss. */
export function BankEmpty({
  hasAccounts,
  hasPayments,
  filter,
  searching,
  onUpload,
}: {
  hasAccounts: boolean
  hasPayments: boolean
  filter: BankFilter
  searching: boolean
  onUpload: () => void
}) {
  if (!hasAccounts) {
    return (
      <EmptyState illustration="bank" title={t.emptyTitle}>
        {t.emptyNoAccount}
      </EmptyState>
    )
  }
  if (!hasPayments && !searching) {
    return (
      <EmptyState
        illustration="bank"
        title={t.emptyTitle}
        action={
          <Button onClick={onUpload}>
            <Upload aria-hidden /> {t.upload}
          </Button>
        }
      >
        {t.empty}
      </EmptyState>
    )
  }
  if (searching) return <EmptyState illustration="search" title={t.emptyFiltered} />
  if (filter === 'unmatched') {
    return (
      <EmptyState icon={Check} title={t.emptyUnmatchedTitle}>
        {t.emptyUnmatched}
      </EmptyState>
    )
  }
  const copy = (
    {
      matched: [t.emptyMatchedTitle, t.emptyMatched],
      outgoing: [t.emptyOutgoingTitle, t.emptyOutgoing],
      ignored: [t.emptyIgnoredTitle, t.emptyIgnored],
    } as const
  )[filter]
  return (
    <EmptyState illustration="bank" title={copy[0]}>
      {copy[1]}
    </EmptyState>
  )
}
