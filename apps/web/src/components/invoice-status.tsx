import type { RouterOutputs } from '@fakturky/core/router'
import { type DocumentStatus, StatusBadge } from '@fakturky/ui/components/status-badge'
import { Sparkles } from 'lucide-react'
import { cs } from '@/i18n/cs'

type Display = RouterOutputs['documents']['list'][number]['displayStatus']

const map: Record<Display, DocumentStatus> = {
  draft: 'draft',
  issued: 'issued',
  overdue: 'overdue',
  partially_paid: 'partial',
  paid: 'paid',
  cancelled: 'cancelled',
}

export function InvoiceStatus({
  status,
  viaAssistant,
  overdueDays,
}: {
  status: Display
  viaAssistant?: boolean
  /** Days past due; an overdue badge then reads "14 dní po splatnosti". */
  overdueDays?: number
}) {
  // Drafts the assistant proposed say so: the user still has to review and issue them.
  if (status === 'draft' && viaAssistant) {
    return (
      <StatusBadge status="draft" icon={Sparkles}>
        {cs.invoices.assistantDraft}
      </StatusBadge>
    )
  }
  return (
    <StatusBadge status={map[status]} overdueDays={overdueDays}>
      {cs.invoices.status[status]}
    </StatusBadge>
  )
}
