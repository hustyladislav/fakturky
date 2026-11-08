import { Button } from '@fakturky/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@fakturky/ui/components/dropdown-menu'
import { cn } from '@fakturky/ui/lib/utils'
import { Link } from '@tanstack/react-router'
import {
  Ban,
  BookmarkPlus,
  ChevronDown,
  CopyPlus,
  Download,
  FileCheck,
  FileMinus,
  Pencil,
  Receipt,
  Send,
  Trash2,
  Undo2,
} from 'lucide-react'
import { type ComponentType, Fragment } from 'react'
import type { ActionId, ActionPlan } from '@/components/invoice-detail/actions'
import { PaySplitButton, ShareButton } from '@/components/invoice-detail/share-pay'
import type { InvoiceController } from '@/components/invoice-detail/use-invoice-controller'
import { cs } from '@/i18n/cs'

const t = cs.invoices.detail

const MENU: Partial<
  Record<ActionId, { label: string; icon: ComponentType<{ 'aria-hidden'?: boolean }> }>
> = {
  markUnpaid: { label: t.markUnpaid, icon: Undo2 },
  duplicate: { label: t.duplicate, icon: CopyPlus },
  template: { label: cs.templates.saveAs, icon: BookmarkPlus },
  credit: { label: t.creditNote, icon: FileMinus },
  receipt: { label: t.receipt, icon: Receipt },
  final: { label: t.finalInvoice, icon: FileCheck },
  cancel: { label: t.cancel, icon: Ban },
  delete: { label: t.delete, icon: Trash2 },
}

/** One button for one action. The primary is ink and full width; quiet ones sit beside each other. */
export function ActionButton({
  action,
  ctrl,
  plan,
  tone,
  className,
}: {
  action: ActionId
  ctrl: InvoiceController
  plan: ActionPlan
  tone: 'primary' | 'quiet'
  className?: string
}) {
  const primary = tone === 'primary'
  const variant = primary ? 'default' : 'outline'
  const size = primary ? 'lg' : 'default'
  const cls = cn(primary && 'w-full', className)
  const disabled = ctrl.pending[action]
  const label: Partial<Record<ActionId, string>> = {
    issue: t.issue,
    receipt: t.receipt,
    final: t.finalInvoice,
  }

  switch (action) {
    case 'share':
      return (
        <ShareButton
          copied={ctrl.copied}
          variant={variant}
          size={size}
          className={cls}
          onShare={() => ctrl.run('share')}
        />
      )
    case 'pay':
      return (
        <PaySplitButton
          variant={variant}
          className={cn(primary ? 'h-10 pointer-coarse:h-11' : 'h-9 pointer-coarse:h-11', cls)}
          disabled={disabled}
          onPayNow={() => ctrl.run('pay')}
          onMore={() => ctrl.setPanel('pay')}
        />
      )
    case 'pdf':
      return (
        <Button
          variant={variant}
          size={size}
          className={cls}
          nativeButton={false}
          render={<a href={`/api/documents/${ctrl.id}/pdf`} download />}
        >
          <Download />
          {primary ? (
            t.downloadPdf
          ) : (
            <>
              <span className="sr-only">{t.downloadPdfVerb} </span>
              <span>PDF</span>
            </>
          )}
        </Button>
      )
    case 'edit':
      return (
        <Button
          variant={variant}
          size={size}
          className={cls}
          nativeButton={false}
          render={<Link to="/faktury/$id/upravit" params={{ id: ctrl.id }} />}
        >
          <Pencil /> {t.edit}
        </Button>
      )
    case 'send':
      return (
        <Button
          variant={variant}
          size={size}
          className={cls}
          aria-label={plan.sendIsReminder ? t.remind : t.send}
          onClick={() => ctrl.run('send')}
        >
          <Send />
          <span>{plan.sendIsReminder ? t.remindShort : t.sendShort}</span>
        </Button>
      )
    default:
      return (
        <Button
          variant={variant}
          size={size}
          className={cls}
          disabled={disabled}
          onClick={() => ctrl.run(action)}
        >
          {label[action]}
        </Button>
      )
  }
}

/** "Více": the rarely used actions; the destructive one is last, behind a separator. */
export function MoreMenu({
  actions,
  ctrl,
  className,
}: {
  actions: ActionId[]
  ctrl: InvoiceController
  className?: string
}) {
  if (actions.length === 0) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" className={className} />}>
        {t.more}
        <ChevronDown aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="end">
        {actions.map((a) => {
          const item = MENU[a]
          if (!item) return null
          const Icon = item.icon
          if (a === 'cancel') {
            return (
              <Fragment key={a}>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive [&_svg]:text-destructive"
                  disabled={ctrl.pending.cancel}
                  onClick={() => ctrl.run(a)}
                >
                  <Icon aria-hidden /> {item.label}
                </DropdownMenuItem>
              </Fragment>
            )
          }
          return (
            <DropdownMenuItem key={a} onClick={() => ctrl.run(a)}>
              <Icon aria-hidden /> {item.label}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
