import { BRAND } from '@fakturky/core/brand'
import { useEffect } from 'react'

/** Per-route document title: "Faktury · Fakturky". */
export const pageHead = (label: string) => () => ({
  meta: [{ title: `${label} · ${BRAND.name}` }],
})

/** Sets the tab title once a label is known (an invoice number, say); the route's static head is the fallback. */
export function useDocumentTitle(label: string | null | undefined) {
  useEffect(() => {
    if (label) document.title = `${label} · ${BRAND.name}`
  }, [label])
}
