import type { ReactNode } from 'react'

/** A document section: space above, a hairline between sections, an optional quiet heading. */
export function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="border-t py-6 first:border-t-0 first:pt-0">
      {title && <h2 className="mb-3 text-muted-foreground text-sm">{title}</h2>}
      {children}
    </div>
  )
}
