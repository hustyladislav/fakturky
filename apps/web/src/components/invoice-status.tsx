import type { RouterOutputs } from '@fakturky/core/router'
import { type DocumentStatus, StatusBadge } from '@fakturky/ui/components/status-badge'
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

export function InvoiceStatus({ status }: { status: Display }) {
  return <StatusBadge status={map[status]}>{cs.invoices.status[status]}</StatusBadge>
}
