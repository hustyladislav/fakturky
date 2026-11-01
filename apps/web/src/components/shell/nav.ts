import { FileStack, FileText, LayoutDashboard, Settings, Users } from 'lucide-react'
import { cs } from '@/i18n/cs'

export const NEW_INVOICE_PATH = '/faktury/nova'

export const navItems = [
  { to: '/prehled', label: cs.nav.overview, icon: LayoutDashboard, goKey: 'p' },
  { to: '/faktury', label: cs.nav.invoices, icon: FileText, goKey: 'f' },
  { to: '/kontakty', label: cs.nav.contacts, icon: Users, goKey: 'k' },
  { to: '/nastaveni', label: cs.nav.settings, icon: Settings, goKey: 'n' },
  { to: '/sablony', label: cs.nav.templates, icon: FileStack, goKey: 's' },
] as const

export type NavPath = (typeof navItems)[number]['to']
