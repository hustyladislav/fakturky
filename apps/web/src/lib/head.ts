import { BRAND } from '@fakturky/core/brand'

/** Per-route document title: "Faktury · Fakturky". */
export const pageHead = (label: string) => () => ({
  meta: [{ title: `${label} · ${BRAND.name}` }],
})
