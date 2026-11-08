import { Amount } from '@fakturky/ui/components/amount'
import { Button } from '@fakturky/ui/components/button'
import { Kbd } from '@fakturky/ui/components/kbd'
import { cn } from '@fakturky/ui/lib/utils'
import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cs } from '@/i18n/cs'
import { PreviewButton } from './preview'
import type { InvoiceDraft } from './use-invoice-draft'

const t = cs.invoices.form

/** Height of the on-screen keyboard (0 when closed), from the visual viewport. */
function useKeyboardInset(): number {
  const [inset, setInset] = useState(0)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => {
      const covered = window.innerHeight - vv.height - vv.offsetTop
      setInset(covered > 120 ? Math.round(covered) : 0)
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])
  return inset
}

/** Sticky bar: the total, whether anything is unsaved, and the ways out. Clears the tab bar and the keyboard. */
export function ActionBar({ draft, onPreview }: { draft: InvoiceDraft; onPreview: () => void }) {
  const { submit, dirty, draftId, ready, totals, fields } = draft
  const keyboard = useKeyboardInset()
  return (
    <div
      className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 -mx-4 mt-6 border-t bg-background px-4 py-3 md:bottom-0 md:-mx-8 md:px-8"
      // The tab bar sits under the keyboard; the bar rides on top of the keyboard instead.
      style={keyboard ? { bottom: keyboard } : undefined}
    >
      {submit.confirmNoBank && (
        <div
          role="alert"
          className="mx-auto mb-3 flex max-w-[1136px] flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-warning/50 bg-warning/14 px-3 py-2 text-sm"
        >
          <span className="min-w-0 flex-1">{t.noBankConfirm}</span>
          <span className="flex gap-2">
            <Button
              type="button"
              size="sm"
              autoFocus
              onClick={submit.issue}
              disabled={submit.pending}
            >
              {t.noBankConfirmYes}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={submit.cancelNoBank}>
              {cs.common.cancel}
            </Button>
          </span>
        </div>
      )}
      <div className="mx-auto flex max-w-[1136px] items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-muted-foreground text-xs max-sm:sr-only">{t.totalShort}</div>
          <div className="flex items-baseline gap-3">
            <Amount
              value={totals?.total ?? '0'}
              currency={fields.currency}
              size="md"
              className="max-sm:text-lg [&>.opacity-60]:opacity-80"
            />
            <span
              className={cn(
                'hidden items-center gap-1.5 text-xs sm:flex',
                dirty ? 'text-warning' : 'text-muted-foreground',
              )}
              aria-live="polite"
            >
              {dirty && <span aria-hidden className="size-1.5 rounded-full bg-current" />}
              {dirty ? t.unsaved : draftId ? t.savedState : ''}
            </span>
          </div>
        </div>
        <PreviewButton onClick={onPreview} />
        <Button
          type="button"
          variant="outline"
          disabled={submit.pending || !ready}
          onClick={submit.saveDraft}
        >
          {t.saveDraft}
        </Button>
        <Button
          type="button"
          title={t.issueHint}
          disabled={submit.pending || !ready}
          onClick={submit.issue}
        >
          {submit.pending && <Loader2 className="animate-spin" aria-hidden />}
          {t.issue}
          <Kbd
            aria-hidden
            className="ml-1 hidden border-primary-foreground/30 bg-primary-foreground/15 text-primary-foreground sm:inline-flex"
          >
            ⌘↵
          </Kbd>
        </Button>
      </div>
    </div>
  )
}
