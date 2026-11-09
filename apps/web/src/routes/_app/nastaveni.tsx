import { Button } from '@fakturky/ui/components/button'
import { PageHeader } from '@fakturky/ui/components/page-header'
import { cn } from '@fakturky/ui/lib/utils'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { BusinessCard } from '@/components/business-profile/business-card'
import {
  BusinessProfileForm,
  type ProfileValues,
} from '@/components/business-profile/business-profile-form'
import { ApiKeys } from '@/components/settings/api-keys'
import { AppearanceCard } from '@/components/settings/appearance-card'
import { BankAccountsCard } from '@/components/settings/bank-accounts-card'
import { NumberSeriesCard } from '@/components/settings/number-series-card'
import { DataExport, ReminderSettings } from '@/components/settings/reminder-settings'
import { SettingsSection } from '@/components/settings-section'
import { cs } from '@/i18n/cs'
import { pageHead } from '@/lib/head'
import { orpc } from '@/lib/orpc'

export const Route = createFileRoute('/_app/nastaveni')({
  head: pageHead(cs.settings.title),
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(orpc.businessProfile.get.queryOptions()),
  component: Settings,
})

/** Anchor ids double as deep links: /nastaveni#banka. */
const SECTIONS = [
  { id: 'firma', label: cs.settings.nav.company },
  { id: 'banka', label: cs.settings.nav.bank },
  { id: 'rady', label: cs.settings.nav.series },
  { id: 'vzhled', label: cs.settings.nav.appearance },
  { id: 'emaily', label: cs.settings.nav.emails },
  { id: 'api', label: cs.settings.nav.api },
  { id: 'import', label: cs.settings.nav.import },
  { id: 'ucet', label: cs.settings.nav.account },
] as const

type SectionId = (typeof SECTIONS)[number]['id']

/** Highlights the section currently under the sticky header. */
function useActiveSection(): SectionId {
  const [active, setActive] = useState<SectionId>('firma')
  useEffect(() => {
    const visible = new Map<string, number>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.set(e.target.id, e.boundingClientRect.top)
          else visible.delete(e.target.id)
        }
        const first = SECTIONS.find((s) => visible.has(s.id))
        if (first) setActive(first.id)
      },
      { rootMargin: '-120px 0px -55% 0px' },
    )
    for (const s of SECTIONS) {
      const el = document.getElementById(s.id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [])
  return active
}

/** Cards load data after first paint, so an initial #hash must be re-applied once layout settles. */
function useInitialHashScroll() {
  useEffect(() => {
    const id = window.location.hash.slice(1)
    if (!id) return
    const go = () => document.getElementById(id)?.scrollIntoView({ block: 'start' })
    const timers = [setTimeout(go, 150), setTimeout(go, 700)]
    return () => {
      for (const t of timers) clearTimeout(t)
    }
  }, [])
}

function SettingsNav({ active, onPick }: { active: SectionId; onPick: (id: SectionId) => void }) {
  return (
    <nav aria-label={cs.settings.navLabel} className="lg:sticky lg:top-20 lg:self-start">
      <ul className="-mt-2 flex flex-wrap gap-x-5 lg:mt-0 lg:flex-col lg:gap-x-0 lg:border-l">
        {SECTIONS.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              aria-current={active === s.id ? 'location' : undefined}
              onClick={() => onPick(s.id)}
              className={cn(
                'flex h-11 items-center text-sm text-muted-foreground transition-colors hover:text-foreground lg:-ml-px lg:h-9 lg:border-l lg:border-transparent lg:pl-4',
                active === s.id &&
                  'text-foreground underline underline-offset-8 lg:border-foreground lg:no-underline',
              )}
            >
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function Settings() {
  const { data: profile } = useQuery(orpc.businessProfile.get.queryOptions())
  const observed = useActiveSection()
  const [picked, setPicked] = useState<SectionId | null>(null)
  useInitialHashScroll()
  // A click wins until the user scrolls on by hand (programmatic scrolling fires no wheel/touch events).
  useEffect(() => {
    if (!picked) return
    const clear = () => setPicked(null)
    window.addEventListener('wheel', clear, { once: true })
    window.addEventListener('touchmove', clear, { once: true })
    return () => {
      window.removeEventListener('wheel', clear)
      window.removeEventListener('touchmove', clear)
    }
  }, [picked])
  const active = picked ?? observed
  const appearance = useQuery(orpc.appearance.get.queryOptions({ input: {} }))
  const [preview, setPreview] = useState<ProfileValues | null>(null)

  return (
    <div className="mx-auto max-w-[1180px]">
      <PageHeader
        title={cs.settings.title}
        subtitle={
          profile ? cs.settings.subtitle(profile.legalName, profile.ico ?? null) : undefined
        }
      />
      <div className="grid gap-6 lg:grid-cols-[11rem_minmax(0,1fr)] lg:gap-14">
        <SettingsNav active={active} onPick={setPicked} />
        <div className="min-w-0 max-w-[52rem] space-y-10">
          <SettingsSection
            id="firma"
            title={cs.settings.profileTitle}
            description={cs.settings.profileDescription}
          >
            <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_18rem]">
              {profile && (
                <BusinessProfileForm
                  profile={profile}
                  submitLabel={cs.common.save}
                  onValuesChange={setPreview}
                />
              )}
              {preview && (
                <BusinessCard
                  values={preview}
                  logo={appearance.data?.logo ?? null}
                  accent={appearance.data?.accentColor ?? null}
                  className="order-first xl:sticky xl:top-20 xl:order-last"
                />
              )}
            </div>
          </SettingsSection>
          <BankAccountsCard />
          <NumberSeriesCard />
          <AppearanceCard />
          <ReminderSettings />
          <ApiKeys />
          <SettingsSection
            id="import"
            title={cs.import.settingsCardTitle}
            description={cs.import.settingsCardDescription}
            action={
              <Button variant="outline" render={<Link to="/import" />}>
                {cs.import.open}
              </Button>
            }
          />
          <DataExport />
        </div>
      </div>
    </div>
  )
}
