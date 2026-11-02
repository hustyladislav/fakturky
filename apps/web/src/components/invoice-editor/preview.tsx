import { InvoiceSheet, type InvoiceSheetDraft } from '@fakturky/pdf/html'
import { Button } from '@fakturky/ui/components/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@fakturky/ui/components/sheet'
import { Eye } from 'lucide-react'
import { useSyncExternalStore } from 'react'
import { cs } from '@/i18n/cs'

const t = cs.invoices.form

/** True from the `xl` breakpoint (1280 px) up: the two-pane editor. */
export function useIsWide(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia('(min-width: 1280px)')
      mq.addEventListener('change', cb)
      return () => mq.removeEventListener('change', cb)
    },
    () => window.matchMedia('(min-width: 1280px)').matches,
    () => false,
  )
}

/** The live paper next to the editor (sticky). */
export function PreviewPane({ doc }: { doc: InvoiceSheetDraft }) {
  return (
    <aside
      aria-label={t.previewTitle}
      // Scrollable on short screens, so it must be reachable by keyboard.
      tabIndex={0}
      className="sticky top-[4.5rem] max-h-[calc(100dvh-9rem)] self-start overflow-y-auto pb-2 [scrollbar-width:thin]"
    >
      <div className="label-caps mb-2 flex items-center gap-1.5">
        <Eye className="size-3.5" aria-hidden /> {t.previewTitle}
      </div>
      <div className="overflow-hidden rounded-[3px] shadow-[var(--shadow-sheet)]">
        <InvoiceSheet doc={doc} maxScale={1.2} headingLevel={3} decorative />
      </div>
    </aside>
  )
}

/** Below 1280 px the preview is a side sheet behind the "Náhled" button. */
export function PreviewSheet({
  doc,
  open,
  onOpenChange,
}: {
  doc: InvoiceSheetDraft
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-[680px]">
        <SheetHeader className="hairline-b px-4 py-3">
          <SheetTitle>{t.previewTitle}</SheetTitle>
          <SheetDescription className="sr-only">{t.previewTitle}</SheetDescription>
        </SheetHeader>
        <div className="min-h-full flex-1 bg-background p-4">
          <div className="overflow-hidden rounded-[3px] shadow-[var(--shadow-sheet)]">
            <InvoiceSheet doc={doc} maxScale={1.4} headingLevel={3} />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

export function PreviewButton({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" variant="ghost" className="xl:hidden" onClick={onClick}>
      <Eye />
      <span className="max-sm:sr-only">{t.preview}</span>
    </Button>
  )
}
