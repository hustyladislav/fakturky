import { useQuery } from '@tanstack/react-query'
import { useRouterState } from '@tanstack/react-router'
import {
  FileStack,
  FileText,
  Landmark,
  LayoutDashboard,
  Receipt,
  Settings,
  Users,
} from 'lucide-react'
import { cs } from '@/i18n/cs'
import { orpc } from '@/lib/orpc'

export type NavPath =
  | '/prehled'
  | '/faktury'
  | '/kontakty'
  | '/banka'
  | '/nastaveni'
  | '/sablony'
  | '/dph'

export interface NavItem {
  to: NavPath
  label: string
  icon: typeof Receipt
  goKey: string
  payerOnly?: boolean
}

export const NEW_INVOICE_PATH = '/faktury/nova'

export const navItems: readonly NavItem[] = [
  { to: '/prehled', label: cs.nav.overview, icon: LayoutDashboard, goKey: 'p' },
  { to: '/faktury', label: cs.nav.invoices, icon: FileText, goKey: 'f' },
  { to: '/kontakty', label: cs.nav.contacts, icon: Users, goKey: 'k' },
  { to: '/banka', label: cs.nav.bank, icon: Landmark, goKey: 'b' },
  { to: '/dph', label: cs.nav.vat, icon: Receipt, goKey: 'd', payerOnly: true },
  { to: '/sablony', label: cs.nav.templates, icon: FileStack, goKey: 's' },
  { to: '/nastaveni', label: cs.nav.settings, icon: Settings, goKey: 'n' },
]

/** Navigation entries visible to this organization (the DPH page is for VAT payers only). */
/** The editor has its own action bar; "new invoice" there would only compete with "Vystavit". */
export function useInEditor(): boolean {
  return useRouterState({
    select: (s) => /^\/faktury\/(nova|[^/]+\/upravit)$/.test(s.location.pathname),
  })
}

export function useNavItems(): readonly NavItem[] {
  const profile = useQuery(orpc.businessProfile.get.queryOptions())
  const payer = profile.data?.vatStatus === 'payer'
  return navItems.filter((n) => !n.payerOnly || payer)
}
