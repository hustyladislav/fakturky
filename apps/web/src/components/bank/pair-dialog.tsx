import { formatMoney } from '@fakturky/domain'
import { Button } from '@fakturky/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@fakturky/ui/components/dialog'
import { Input } from '@fakturky/ui/components/input'
import { Money } from '@fakturky/ui/components/money'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { cs } from '@/i18n/cs'
import { orpc } from '@/lib/orpc'
import { bankErrorMessage } from './bank-errors'

const t = cs.bank

/** Manual pairing: pick one of the unpaid invoices for an incoming payment. */
export function PairDialog({
  transaction,
  onClose,
}: {
  transaction: { id: string; amount: string; currency: string } | null
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [term, setTerm] = useState('')
  const list = useQuery({
    ...orpc.documents.list.queryOptions({
      input: { filter: 'unpaid', type: 'invoice', search: term || undefined },
    }),
    enabled: transaction !== null,
  })
  const match = useMutation(
    orpc.bank.match.mutationOptions({
      onSuccess: async () => {
        toast.success(t.matched)
        await queryClient.invalidateQueries()
        onClose()
      },
      onError: (e) => toast.error(bankErrorMessage(e)),
    }),
  )
  const candidates = (list.data ?? []).filter(
    (d) => d.currency === transaction?.currency && Number(d.remaining) > 0,
  )

  return (
    <Dialog open={transaction !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.pairTitle}</DialogTitle>
          <DialogDescription>
            {transaction ? t.pairHelp(formatMoney(transaction.amount, transaction.currency)) : ''}
          </DialogDescription>
        </DialogHeader>
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder={t.pairSearch}
          aria-label={t.pairSearch}
        />
        <ul className="max-h-72 divide-y overflow-auto rounded-lg border">
          {candidates.length === 0 && (
            <li className="text-muted-foreground p-3 text-sm">{t.noOpen}</li>
          )}
          {candidates.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 p-3 text-sm">
              <div className="min-w-0">
                <div className="font-medium tabular-nums">{d.number}</div>
                <div className="text-muted-foreground truncate">{d.customerName ?? '—'}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground text-xs">
                  {t.remaining} <Money amount={d.remaining} currency={d.currency} />
                </span>
                <Button
                  size="sm"
                  disabled={match.isPending || !transaction}
                  onClick={() =>
                    transaction && match.mutate({ transactionId: transaction.id, documentId: d.id })
                  }
                >
                  {t.pair}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
