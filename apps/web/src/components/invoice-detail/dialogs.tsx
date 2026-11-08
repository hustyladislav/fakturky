import { Input } from '@fakturky/ui/components/input'
import { Label } from '@fakturky/ui/components/label'
import { NativeSelect } from '@fakturky/ui/components/native-select'
import { useState } from 'react'
import { CreditNoteDialog } from '@/components/invoice-detail/credit-note-dialog'
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
  const { id, dialog, setDialog } = ctrl
  const [rate12, setRate12] = useState('')
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
        pending={ctrl.cancel.isPending}
        onConfirm={() => {
          setDialog(null)
          ctrl.cancel.mutate({ id })
        }}
      />
      <PromptDialog
        open={dialog === 'delete'}
        onOpenChange={close}
        title={t.delete}
        description={t.deleteConfirm}
        confirmLabel={t.delete}
        destructive
        pending={ctrl.remove.isPending}
        onConfirm={() => {
          setDialog(null)
          ctrl.remove.mutate({ id })
        }}
      />
      <PromptDialog
        open={dialog === 'rotate'}
        onOpenChange={close}
        title={t.rotateLink}
        description={t.rotateLinkConfirm}
        confirmLabel={t.rotateLink}
        pending={ctrl.rotateLink.isPending}
        onConfirm={() => {
          setDialog(null)
          ctrl.rotateLink.mutate({ id })
        }}
      />
      <PromptDialog
        open={dialog === 'template'}
        onOpenChange={close}
        title={cs.templates.saveAs}
        confirmLabel={cs.common.save}
        pending={ctrl.saveTemplate.isPending}
        input={{
          label: cs.templates.namePrompt,
          defaultValue: templateName(d),
          required: true,
        }}
        onConfirm={(name) => {
          setDialog(null)
          ctrl.saveTemplate.mutate({ documentId: id, name })
        }}
      />
      <CreditNoteDialog
        open={dialog === 'credit'}
        onOpenChange={close}
        doc={d}
        pending={ctrl.creditNote.isPending}
        onConfirm={(v) => {
          setDialog(null)
          ctrl.creditNote.mutate({ id, reason: v.reason, amount: v.amount })
        }}
      />
      <PromptDialog
        open={dialog === 'receipt'}
        onOpenChange={close}
        title={t.receipt}
        description={t.receiptDescription(d.paidAmount, d.currency)}
        confirmLabel={t.receipt}
        pending={ctrl.receipt.isPending}
        onConfirm={() => {
          setDialog(null)
          if (receiptRate === 'split') {
            const reduced = Number(rate12.replace(',', '.') || 0)
            const total = Number(d.paidAmount)
            ctrl.receipt.mutate({
              id,
              allocations: [
                { vatRate: '21', amount: (total - reduced).toFixed(2) },
                { vatRate: '12', amount: reduced.toFixed(2) },
              ],
            })
          } else {
            ctrl.receipt.mutate({ id, vatRate: receiptRate })
          }
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
              {t.receiptAmount21(
                (Number(d.paidAmount) - Number(rate12.replace(',', '.') || 0)).toFixed(2),
              )}
            </p>
          </div>
        )}
      </PromptDialog>
    </>
  )
}
