import { InvoiceSheet, type InvoiceSheetDraft, type QrData } from '@fakturky/pdf/html'
import { cn } from '@fakturky/ui/lib/utils'
import { ChevronDown, FileText } from 'lucide-react'
import { cs } from '@/i18n/cs'

const t = cs.invoices.detail

/**
 * The real document (HTML twin of the PDF) lying on the desk. Below `lg` it sits behind a full-width
 * tappable row: the summary and the actions are what a phone needs first.
 */
export function DocumentPaper({
  doc,
  qr,
  open,
  onToggle,
  className,
}: {
  doc: InvoiceSheetDraft
  qr: QrData | null | undefined
  open: boolean
  onToggle: () => void
  className?: string
}) {
  return (
    <div className={className}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls="doc-paper"
        className="hairline flex min-h-12 w-full items-center justify-between py-3 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50 lg:hidden"
      >
        <span className="flex items-center gap-2">
          <FileText className="size-4 text-muted-foreground" aria-hidden />
          {open ? t.hideDocument : t.showDocument}
        </span>
        <ChevronDown
          className={cn(
            'size-4 text-muted-foreground transition-transform duration-150 ease-out',
            open && 'rotate-180',
          )}
          aria-hidden
        />
      </button>
      <div
        id="doc-paper"
        className={cn('mx-auto mt-3 max-w-[780px] lg:mt-0', !open && 'max-lg:hidden')}
      >
        <div className="overflow-hidden rounded-[3px] shadow-[var(--shadow-sheet)]">
          <InvoiceSheet doc={doc} {...(qr !== undefined ? { qr } : {})} maxScale={1.5} />
        </div>
      </div>
    </div>
  )
}
