import { Amount } from '@fakturky/ui/components/amount'
import { Button } from '@fakturky/ui/components/button'
import { cn } from '@fakturky/ui/lib/utils'
import { Copy } from 'lucide-react'
import { toast } from 'sonner'
import { RailSection } from '@/components/invoice-detail/rail-section'
import { PaymentQr } from '@/components/payment-qr'
import { cs } from '@/i18n/cs'
import type { DocumentDetail } from '@/lib/document-sheet'

const t = cs.invoices.detail

type Snap = Record<string, string | null> | null

function CopyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <dt className="shrink-0 text-[13px] text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 items-center gap-1">
        <span className="min-w-0 truncate text-sm tabular-nums" title={value}>
          {value}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          className="pointer-coarse:size-11"
          aria-label={`${t.copy}: ${label}`}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value)
              toast.success(t.copied)
            } catch {
              /* clipboard blocked: nothing to do */
            }
          }}
        >
          <Copy />
        </Button>
      </dd>
    </div>
  )
}

/** QR and the numbers a bank form asks for; only while there is something left to pay. */
export function PaymentSection({ d, className }: { d: DocumentDetail; className?: string }) {
  const bank = d.bankSnapshot as Snap
  const open = d.status === 'issued' && d.type !== 'credit_note'
  if (!d.paymentQr && !(open && bank?.iban)) return null
  const account = bank?.accountNumber ? `${bank.accountNumber}/${bank.bankCode}` : null
  return (
    <RailSection title={t.payment} testId="payment-card" {...(className && { className })}>
      {d.paymentQr && (
        <div className="flex items-center gap-4">
          <PaymentQr qr={d.paymentQr} className="size-40 ring-1 ring-border" />
          <figure className="min-w-0 space-y-1 text-sm">
            <figcaption className="font-medium">
              {d.paymentQr.kind === 'spayd' ? cs.paymentQr.platba : cs.paymentQr.epc}
            </figcaption>
            <p className="text-xs text-muted-foreground">{cs.paymentQr.hint}</p>
            <p className="pt-1">
              <Amount value={d.remaining} currency={d.currency} size="inline" />
            </p>
          </figure>
        </div>
      )}
      <dl className={cn('divide-y divide-border', d.paymentQr && 'mt-3')}>
        {account && <CopyRow label={t.account} value={account} />}
        {bank?.iban && <CopyRow label={t.iban} value={bank.iban} />}
        {d.variableSymbol && <CopyRow label={t.variableSymbol} value={d.variableSymbol} />}
      </dl>
    </RailSection>
  )
}
