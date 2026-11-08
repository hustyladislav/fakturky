import type { RouterOutputs } from '@fakturky/core/router'
import { formatMoney } from '@fakturky/domain'
import { formatDateCs } from '@fakturky/domain/dates'
import { Amount } from '@fakturky/ui/components/amount'
import { Button } from '@fakturky/ui/components/button'
import { Link } from '@tanstack/react-router'
import { Check } from 'lucide-react'
import { cs } from '@/i18n/cs'
import { useBankRowActions } from './bank-mutations'

type Tx = RouterOutputs['bank']['list']['items'][number]
export type PairTarget = { id: string; amount: string; currency: string }

const t = cs.bank

function Suggestion({
  tx,
  s,
  onConfirm,
  pending,
}: {
  tx: Tx
  s: Tx['suggestions'][number]
  onConfirm: (transactionId: string, documentId: string) => void
  pending: boolean
}) {
  return (
    <div className="col-span-full flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-l-2 pl-3">
      <div className="min-w-0 text-sm">
        <p>
          <span className="text-muted-foreground">{t.suggestion}</span>{' '}
          <span className="font-medium tabular-nums">{s.number}</span>
          {s.customerName && <span className="text-muted-foreground"> · {s.customerName}</span>}
          <span className="text-muted-foreground"> · {t.remaining} </span>
          <Amount value={s.remaining} currency={s.currency} size="sm" />
        </p>
        <p className="text-[13px] text-muted-foreground">
          {s.reasons.map((r) => t.reasons[r]).join(' · ')}
        </p>
      </div>
      <Button disabled={pending} onClick={() => onConfirm(tx.id, s.documentId)}>
        <Check aria-hidden /> {t.confirm}
      </Button>
    </div>
  )
}

function Row({ tx, onPair }: { tx: Tx; onPair: (target: PairTarget) => void }) {
  const { confirm, unmatch, ignore } = useBankRowActions()
  const incoming = Number(tx.amount) > 0
  const open = tx.matchStatus === 'unmatched' && incoming
  const pairing = { id: tx.id, amount: tx.amount, currency: tx.currency }
  return (
    <li
      data-testid="bank-row"
      className="row-hover grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 border-b py-3 sm:-mx-3 sm:px-3 sm:grid-cols-[minmax(0,1fr)_auto_9rem]"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <span className="font-medium break-words">{tx.counterpartyName ?? '—'}</span>
          {tx.overpaid && (
            <span className="text-[13px] text-destructive">
              {t.overpaid(formatMoney(tx.overpaid, tx.currency))}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-muted-foreground">
          <span className="sr-only">{incoming ? t.incoming : t.outgoing}</span>
          <time dateTime={tx.bookedOn} className="tabular-nums">
            {formatDateCs(tx.bookedOn)}
          </time>
          {tx.variableSymbol && (
            <span className="tabular-nums">
              {t.vs} {tx.variableSymbol}
            </span>
          )}
          {tx.counterpartyAccount && <span className="tabular-nums">{tx.counterpartyAccount}</span>}
          {tx.message && <span className="min-w-0 break-words">{tx.message}</span>}
        </div>
      </div>

      <Amount
        value={tx.amount}
        currency={tx.currency}
        size="inline"
        tone={incoming ? 'default' : 'muted'}
        className="text-[15px] sm:col-start-3 sm:row-start-1 sm:text-right"
      />

      <div className="col-span-full flex flex-wrap items-center gap-2 empty:hidden sm:col-span-1 sm:col-start-2 sm:row-start-1 sm:justify-end">
        {open && (
          <>
            <Button variant="outline" onClick={() => onPair(pairing)}>
              {t.pairWith}
            </Button>
            <Button
              variant="ghost"
              onClick={() => ignore.mutate({ transactionId: tx.id, ignored: true })}
            >
              {t.ignore}
            </Button>
          </>
        )}
        {tx.matchStatus === 'matched' && (
          <>
            {tx.matchedDocumentId && (
              <Link
                to="/faktury/$id"
                params={{ id: tx.matchedDocumentId }}
                className="text-sm underline-offset-4 outline-none hover:underline focus-visible:underline"
              >
                {t.paidInvoice} {tx.matchedDocumentNumber}
              </Link>
            )}
            <Button
              variant="ghost"
              className="row-actions text-muted-foreground"
              disabled={unmatch.isPending}
              onClick={() => unmatch.mutate({ transactionId: tx.id })}
            >
              {t.unmatch}
            </Button>
          </>
        )}
        {tx.matchStatus === 'ignored' && (
          <Button
            variant="ghost"
            className="row-actions text-muted-foreground"
            onClick={() => ignore.mutate({ transactionId: tx.id, ignored: false })}
          >
            {t.restore}
          </Button>
        )}
      </div>

      {open &&
        tx.suggestions.map((s) => (
          <Suggestion
            key={s.documentId}
            tx={tx}
            s={s}
            pending={confirm.isPending}
            onConfirm={(transactionId, documentId) => confirm.mutate({ transactionId, documentId })}
          />
        ))}
    </li>
  )
}

/** Flat hairline rows: payer and references left, actions beside the right-aligned amount. */
export function TransactionList({
  items,
  onPair,
}: {
  items: Tx[]
  onPair: (target: PairTarget) => void
}) {
  return (
    <ul aria-label={t.title} className="border-t">
      {items.map((tx) => (
        <Row key={tx.id} tx={tx} onPair={onPair} />
      ))}
    </ul>
  )
}
