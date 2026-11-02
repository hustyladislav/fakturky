import { cs } from '../../i18n/cs'

export type PageKey =
  | 'overview'
  | 'invoices'
  | 'invoice'
  | 'contacts'
  | 'bank'
  | 'vat'
  | 'templates'
  | 'settings'
  | 'other'

/** Which app page the user is on, for the context chip and the starter prompts. */
export function pageKey(pathname: string): PageKey {
  if (/^\/faktury\/(?!nova$)[^/]+/.test(pathname)) return 'invoice'
  if (pathname.startsWith('/faktury')) return 'invoices'
  if (pathname.startsWith('/prehled')) return 'overview'
  if (pathname.startsWith('/kontakty')) return 'contacts'
  if (pathname.startsWith('/banka')) return 'bank'
  if (pathname.startsWith('/dph')) return 'vat'
  if (pathname.startsWith('/sablony')) return 'templates'
  if (pathname.startsWith('/nastaveni')) return 'settings'
  return 'other'
}

/** "Na stránce: Faktura 2026-0028" (the number is known only after the document loads). */
export function contextLabel(key: PageKey, documentNumber?: string | null): string {
  const t = cs.assistant.context
  return key === 'invoice' && documentNumber ? t.invoiceNumber(documentNumber) : t.pages[key]
}

export function starters(key: PageKey): readonly string[] {
  return cs.assistant.starters[key]
}
