/** Shared class strings of the marketing pages, so sections stay aligned with each other. */

export const container = 'mx-auto max-w-[1200px] px-5 md:px-8'

/** Section rhythm; an anchored section clears the 56 px sticky header and keeps its own top padding visible. */
export const sectionY = 'py-14 md:py-20'
export const anchor = 'scroll-mt-14'

export const h2 =
  'text-[32px] leading-[38px] tracking-[-0.02em] text-balance md:text-5xl md:leading-[50px]'

export const lead = 'text-[17px] leading-relaxed text-pretty text-muted-foreground'

/** The app's focus ring for links and controls that are not shadcn components. */
export const focusRing = 'rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50'

export const inlineLink = `text-foreground underline underline-offset-4 ${focusRing}`
