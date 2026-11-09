import { Input } from '@fakturky/ui/components/input'
import { Label } from '@fakturky/ui/components/label'
import { NativeSelect } from '@fakturky/ui/components/native-select'
import { useState } from 'react'
import { CreditNoteDialog } from '@/components/invoice-detail/credit-note-dialog'
import { splitReceipt } from '@/components/invoice-detail/receipt-split'
import type { InvoiceController } from '@/components/invoice-detail/use-invoice-controller'
import { PromptDialog } from '@/components/prompt-dialog'
import { cs } from '@/i18n/cs'
import type { DocumentDetail } from '@/lib/document-sheet'

const t = cs.invoices.detail

/** "<service> · <client>": the first line says what is billed, which tells two retainers of one client apart. */
function templateName(d: { lines: { description: string }[]; customerName: string | null }) {
  const service = (d.lines[0]?.description ?? '').trim().slice(0, 50)
  return cs.templates.defaultName(
    service || (d.customerName ?? ''),
    service ? d.customerName : null,
  )
}

/** Every confirmation dialog of the detail page; which one is open lives in the controller. */
export function InvoiceDialogs({ d, ctrl }: { d: DocumentDetail; ctrl: InvoiceController }) {
  const { dialog, setDialog, pending } = ctrl
  const [rate12, setRate12] = useState('')
  const split = splitReceipt(d.paidAmount, rate12)
  const [receiptRate, setReceiptRate] = useState<'21' | '12' | 'split'>('21')
  const close = (o: boolean) => !o && setDialog(null)

  return (
    <>
      <PromptDialog
        open={dialog === 'cancel'}
        onOpenChange={close}
        title={t.cancel}
        description={t.cancelConfirm}
        confirmLabel={t.cancel}
        destructive
        pending={pending.cancel}
        onConfirm={ctrl.cancel}
      />
      <PromptDialog
        open={dialog === 'delete'}
        onOpenChange={close}
        title={t.delete}
        description={t.deleteConfirm}
        confirmLabel={t.delete}
        destructive
        pending={pending.delete}
        onConfirm={ctrl.remove}
      />
      <PromptDialog
        open={dialog === 'rotate'}
        onOpenChange={close}
        title={t.rotateLink}
        description={t.rotateLinkConfirm}
        confirmLabel={t.rotateLink}
        pending={pending.rotate}
        onConfirm={ctrl.rotateLink}
      />
      <PromptDialog
        open={dialog === 'template'}
        onOpenChange={close}
        title={cs.templates.saveAs}
        confirmLabel={cs.common.save}
        pending={pending.template}
        input={{
          label: cs.templates.namePrompt,
          defaultValue: templateName(d),
          required: true,
        }}
        onConfirm={ctrl.saveTemplate}
      />
      <CreditNoteDialog
        open={dialog === 'credit'}
        onOpenChange={close}
        doc={d}
        pending={!!pending.credit}
        onConfirm={(v) => ctrl.creditNote({ reason: v.reason, amount: v.amount })}
      />
      <PromptDialog
        open={dialog === 'receipt'}
        onOpenChange={close}
        title={t.receipt}
        description={t.receiptDescription(d.paidAmount, d.currency)}
        confirmLabel={t.receipt}
        pending={pending.receipt}
        blocked={receiptRate === 'split' && !split}
        onConfirm={() => {
          if (receiptRate !== 'split') return ctrl.receipt({ vatRate: receiptRate })
          if (!split) return
          ctrl.receipt({
            allocations: [
              { vatRate: '21', amount: split.standard },
              { vatRate: '12', amount: split.reduced },
            ],
          })
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="receipt-rate">{t.receiptRate}</Label>
          <NativeSelect
            id="receipt-rate"
            value={receiptRate}
            onChange={(e) => setReceiptRate(e.target.value as '21' | '12' | 'split')}
          >
            <option value="21">21 %</option>
            <option value="12">12 %</option>
            <option value="split">{t.receiptSplit}</option>
          </NativeSelect>
        </div>
        {receiptRate === 'split' && (
          <div className="space-y-2">
            <Label htmlFor="receipt-12">{t.receiptAmount12}</Label>
            <Input
              id="receipt-12"
              inputMode="decimal"
              value={rate12}
              onChange={(e) => setRate12(e.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              {split ? t.receiptAmount21(split.standard) : t.receiptAmountHint}
            </p>
          </div>
        )}
      </PromptDialog>
    </>
  )
}
