import { FileText, LayoutDashboard, Settings, Users } from 'lucide-react'
import { cs } from '@/i18n/cs'

// TODO: point at the new-invoice route once the invoices work lands it (until then: the list).
export const NEW_INVOICE_PATH = '/faktury'

export const navItems = [
  { to: '/', label: cs.nav.overview, icon: LayoutDashboard, goKey: 'p' },
  { to: '/faktury', label: cs.nav.invoices, icon: FileText, goKey: 'f' },
  { to: '/kontakty', label: cs.nav.contacts, icon: Users, goKey: 'k' },
  { to: '/nastaveni', label: cs.nav.settings, icon: Settings, goKey: 'n' },
] as const

export type NavPath = (typeof navItems)[number]['to']
