import { Button } from '@fakturky/ui/components/button'
import { Link } from '@tanstack/react-router'
import { Copy, ExternalLink, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { RailSection } from '@/components/invoice-detail/rail-section'
import { cs } from '@/i18n/cs'
import type { DocumentDetail } from '@/lib/document-sheet'

const t = cs.invoices.detail

type Ref = { id: string; number: string | null; status: string; type: string }

export function RelatedDocs({ d, className }: { d: DocumentDetail; className?: string }) {
  if (!d.parent && d.related.length === 0) return null
  const row = (kind: string, doc: Ref, lead?: string) => (
    <li
      key={`${kind}-${doc.id}`}
      className="row-hover relative -mx-2 flex min-h-11 items-center justify-between gap-3 rounded-lg px-2 py-2 text-sm"
    >
      <span className="text-[13px] text-muted-foreground">
        {lead ?? cs.invoices.type[doc.type as keyof typeof cs.invoices.type]}
        {doc.status === 'cancelled' && ` · ${cs.invoices.status.cancelled}`}
      </span>
      {/* The link is just the number (its accessible name); the stretched ::after makes the row clickable. */}
      <Link
        to="/faktury/$id"
        params={{ id: doc.id }}
        className="font-medium tabular-nums outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
      >
        {doc.number ?? cs.invoices.draftNumber}
      </Link>
    </li>
  )
  return (
    <RailSection title={t.relatedTitle} {...(className && { className })}>
      <ul>
        {d.parent && row('parent', d.parent, t.relatedParent)}
        {d.related.map((r) => row('rel', r))}
      </ul>
    </RailSection>
  )
}

export function PublicLinkSection({
  url,
  rotating,
  onRotate,
  className,
}: {
  url: string
  rotating: boolean
  onRotate: () => void
  className?: string
}) {
  return (
    <RailSection title={t.publicLink} {...(className && { className })}>
      <p className="truncate text-xs text-muted-foreground tabular-nums">
        {url.replace(/^https?:\/\//, '')}
      </p>
      <div className="mt-3 flex gap-2">
        <Button
          variant="outline"
          className="flex-1"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url)
              toast.success(t.linkCopied)
            } catch {
              /* clipboard blocked */
            }
          }}
        >
          <Copy /> {t.copyLink}
        </Button>
        <Button
          variant="outline"
          size="icon"
          nativeButton={false}
          render={<a href={url} target="_blank" rel="noreferrer" aria-label={t.openPublic} />}
        >
          <ExternalLink />
        </Button>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="mt-1 -ml-2 text-muted-foreground pointer-coarse:h-11"
        disabled={rotating}
        onClick={onRotate}
      >
        <RefreshCw /> {t.rotateLink}
      </Button>
    </RailSection>
  )
}
