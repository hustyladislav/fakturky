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
        {candidates.length === 0 ? (
          <p className="rounded-lg border p-3 text-muted-foreground text-sm">{t.noOpen}</p>
        ) : (
          <div className="max-h-[50vh] overflow-auto rounded-lg border">
            {/* One shared grid so the "zbývá" amounts line up (right-aligned, tabular) across rows. */}
            <ul className="grid grid-cols-[minmax(0,1fr)_auto_auto] divide-y">
              <li
                aria-hidden
                className="col-span-3 grid grid-cols-subgrid items-center gap-x-3 bg-muted/50 px-3 py-1.5 text-muted-foreground text-xs"
              >
                <span>{t.pairInvoice}</span>
                <span className="text-right">{t.remainingHeader}</span>
                <span />
              </li>
              {candidates.map((d) => (
                <li
                  key={d.id}
                  className="col-span-3 grid grid-cols-subgrid items-center gap-x-3 p-3 text-sm"
                >
                  <div className="min-w-0">
                    <div className="font-medium tabular-nums">{d.number}</div>
                    <div className="break-words text-muted-foreground">{d.customerName ?? '—'}</div>
                  </div>
                  <div className="whitespace-nowrap text-right tabular-nums">
                    <span className="sr-only">{t.remaining} </span>
                    <Money amount={d.remaining} currency={d.currency} />
                  </div>
                  <Button
                    size="sm"
                    disabled={match.isPending || !transaction}
                    onClick={() =>
                      transaction &&
                      match.mutate({ transactionId: transaction.id, documentId: d.id })
                    }
                  >
                    {t.pair}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
