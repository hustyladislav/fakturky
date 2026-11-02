import { cn } from 'cn'

export type IllustrationName = 'invoices' | 'contacts' | 'bank' | 'templates' | 'search'

/**
 * Single-weight line art (1.5 px strokes) in the brand style: ink lines, one forest-green accent,
 * a soft accent-tinted fill. Decorative; 160x120 viewBox.
 */
const art: Record<IllustrationName, React.ReactNode> = {
  // A sheet of paper with lines, a total rule and a green paid dot.
  invoices: (
    <>
      <rect x="44" y="12" width="72" height="96" rx="6" className="fill-card" />
      <path d="M58 34h28M58 46h44M58 56h44M58 66h30" />
      <path d="M58 86h44" className="stroke-primary" />
      <path d="M92 28h14" />
      <circle cx="108" cy="92" r="14" className="fill-accent stroke-primary" />
      <path d="m102 92 4 4 8-9" className="stroke-primary" />
      <path d="M30 26l6 6M130 20l-5 7M24 84h8" opacity=".5" />
    </>
  ),
  // Two overlapping person cards.
  contacts: (
    <>
      <rect x="22" y="30" width="68" height="64" rx="8" className="fill-card" />
      <circle cx="56" cy="52" r="10" />
      <path d="M38 82c2-11 9-16 18-16s16 5 18 16" />
      <rect x="70" y="42" width="68" height="64" rx="8" className="fill-accent stroke-primary" />
      <circle cx="104" cy="64" r="10" className="fill-card" />
      <path d="M86 94c2-11 9-16 18-16s16 5 18 16" className="fill-card" />
      <path d="M120 24v10M115 29h10" opacity=".5" />
    </>
  ),
  // A bank building with a statement line and a coin.
  bank: (
    <>
      <path d="M30 50 80 24l50 26Z" className="fill-card" />
      <path d="M38 56h84M44 56v38M68 56v38M92 56v38M116 56v38M32 100h96" />
      <circle cx="80" cy="40" r="4" className="stroke-primary" />
      <circle cx="132" cy="92" r="13" className="fill-accent stroke-primary" />
      <path d="M128 92h8M132 88v8" className="stroke-primary" />
    </>
  ),
  // Stack of two templates with a repeat arrow.
  templates: (
    <>
      <rect x="52" y="22" width="68" height="84" rx="6" className="fill-card" opacity=".7" />
      <rect x="40" y="14" width="68" height="84" rx="6" className="fill-card" />
      <path d="M54 36h22M54 48h40M54 58h40M54 68h28" />
      <path d="M54 84h40" className="stroke-primary" />
      <circle cx="118" cy="92" r="16" className="fill-accent stroke-primary" />
      <path
        d="M111 92a7 7 0 0 1 12-5l2 2m0-5v5h-5M125 92a7 7 0 0 1-12 5l-2-2m0 5v-5h5"
        className="stroke-primary"
      />
    </>
  ),
  // Magnifier over an empty page.
  search: (
    <>
      <rect x="34" y="14" width="64" height="86" rx="6" className="fill-card" />
      <path d="M48 34h24M48 46h36M48 58h20" opacity=".6" />
      <circle cx="98" cy="68" r="22" className="fill-accent stroke-primary" />
      <path d="m114 84 18 18" className="stroke-primary" strokeWidth="3" strokeLinecap="round" />
      <path d="M90 62l16 12M106 62 90 74" className="stroke-primary" />
    </>
  ),
}

function EmptyIllustration({ name, className }: { name: IllustrationName; className?: string }) {
  return (
    <svg
      viewBox="0 0 160 120"
      fill="none"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cn('h-28 w-auto stroke-muted-foreground/70', className)}
    >
      {art[name]}
    </svg>
  )
}

export { EmptyIllustration }
