import { Button } from '@fakturky/ui/components/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@fakturky/ui/components/card'
import { PageHeader } from '@fakturky/ui/components/page-header'
import { cn } from '@fakturky/ui/lib/utils'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { ApiKeys } from '@/components/api-keys'
import { AppearanceCard } from '@/components/appearance-card'
import { BankAccountsCard } from '@/components/bank-accounts-card'
import { BusinessCard } from '@/components/business-card'
import { BusinessProfileForm, type ProfileValues } from '@/components/business-profile-form'
import { NumberSeriesCard } from '@/components/number-series-card'
import { DataExport, ReminderSettings } from '@/components/reminder-settings'
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
    <nav
      aria-label={cs.settings.navLabel}
      className="sticky top-14 z-20 -mx-4 overflow-x-auto border-b bg-background/90 px-4 backdrop-blur lg:top-20 lg:mx-0 lg:self-start lg:overflow-visible lg:border-b-0 lg:bg-transparent lg:px-0 lg:backdrop-blur-none"
    >
      <ul className="flex gap-1 py-2 lg:flex-col lg:py-0">
        {SECTIONS.map((s) => (
          <li key={s.id} className="shrink-0">
            <a
              href={`#${s.id}`}
              aria-current={active === s.id ? 'location' : undefined}
              onClick={() => onPick(s.id)}
              className={cn(
                'relative flex h-9 items-center whitespace-nowrap rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground',
                active === s.id &&
                  'sheet !rounded-lg text-foreground before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-primary max-lg:before:hidden',
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

function Section({ id, children }: { id: SectionId; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-32 lg:scroll-mt-20">
      {children}
    </section>
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
      <div className="grid gap-4 lg:grid-cols-[11rem_minmax(0,1fr)] lg:gap-10">
        <SettingsNav active={active} onPick={setPicked} />
        <div className="min-w-0 max-w-[60rem] space-y-6 [&_[data-slot=label]]:label-caps">
          <Section id="firma">
            <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_19rem]">
              <Card>
                <CardHeader>
                  <CardTitle role="heading" aria-level={2}>
                    {cs.settings.profileTitle}
                  </CardTitle>
                  <CardDescription>{cs.settings.profileDescription}</CardDescription>
                </CardHeader>
                <CardContent>
                  {profile && (
                    <BusinessProfileForm
                      profile={profile}
                      submitLabel={cs.common.save}
                      onValuesChange={setPreview}
                    />
                  )}
                </CardContent>
              </Card>
              {preview && (
                <BusinessCard
                  values={preview}
                  logo={appearance.data?.logo ?? null}
                  accent={appearance.data?.accentColor ?? null}
                  className="order-first xl:sticky xl:top-20 xl:order-last"
                />
              )}
            </div>
          </Section>
          <Section id="banka">
            <BankAccountsCard />
          </Section>
          <Section id="rady">
            <NumberSeriesCard />
          </Section>
          <Section id="vzhled">
            <AppearanceCard />
          </Section>
          <Section id="emaily">
            <ReminderSettings />
          </Section>
          <Section id="api">
            <ApiKeys />
          </Section>
          <Section id="import">
            <Card>
              <CardHeader>
                <CardTitle role="heading" aria-level={2}>
                  {cs.import.settingsCardTitle}
                </CardTitle>
                <CardDescription>{cs.import.settingsCardDescription}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button render={<Link to="/import" />}>{cs.import.open}</Button>
              </CardContent>
            </Card>
          </Section>
          <Section id="ucet">
            <DataExport />
          </Section>
        </div>
      </div>
    </div>
  )
}
