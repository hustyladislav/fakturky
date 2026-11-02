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
}: {
  status: Display
  viaAssistant?: boolean
}) {
  // Drafts the assistant proposed say so: the user still has to review and issue them.
  if (status === 'draft' && viaAssistant) {
    return (
      <StatusBadge status="draft" icon={Sparkles}>
        {cs.invoices.assistantDraft}
      </StatusBadge>
    )
  }
  return <StatusBadge status={map[status]}>{cs.invoices.status[status]}</StatusBadge>
}
