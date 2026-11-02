import { BRAND } from '@fakturky/core/brand'
import { Button } from '@fakturky/ui/components/button'
import { Logo } from '@fakturky/ui/components/logo'
import { ThemeToggle } from '@fakturky/ui/components/theme'
import { cn } from '@fakturky/ui/lib/utils'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router'
import { Check, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { BusinessCard } from '@/components/business-card'
import { BusinessProfileForm, type ProfileValues } from '@/components/business-profile-form'
import { cs } from '@/i18n/cs'
import { pageHead } from '@/lib/head'
import { client, orpc } from '@/lib/orpc'
import { getSessionFn } from '@/server/session'

export const Route = createFileRoute('/onboarding')({
  head: pageHead(cs.onboarding.pageTitle),
  beforeLoad: async () => {
    if (!(await getSessionFn())) throw redirect({ to: '/prihlaseni' })
  },
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(orpc.businessProfile.get.queryOptions()),
  component: Onboarding,
})

const t = cs.onboarding
const REDIRECT_MS = 4000

/** 1 Firma -> 2 Zkontrolujte údaje -> 3 Hotovo. The step follows what the user has actually filled in. */
function Progress({ step }: { step: 1 | 2 | 3 }) {
  return (
    <ol className="flex items-center gap-2 sm:gap-3" aria-label={t.progressLabel}>
      {t.steps.map((label, i) => {
        const n = i + 1
        const done = n < step || step === 3
        const current = n === step && step !== 3
        return (
          <li key={label} className="flex items-center gap-2 sm:gap-3">
            {i > 0 && (
              <span
                aria-hidden
                className={cn(
                  'h-px w-5 sm:w-10',
                  n <= step ? 'bg-primary' : 'bg-border',
                  'transition-colors',
                )}
              />
            )}
            <span
              className="flex items-center gap-2 text-sm"
              aria-current={current ? 'step' : undefined}
            >
              <span
                className={cn(
                  'flex size-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums transition-colors',
                  done && 'bg-primary text-primary-foreground',
                  current && 'bg-primary/12 text-primary ring-2 ring-primary/40',
                  !done && !current && 'bg-muted text-muted-foreground',
                )}
              >
                {done ? <Check className="size-3.5" strokeWidth={3} /> : n}
              </span>
              <span
                className={cn(
                  'max-sm:hidden',
                  current || done ? 'font-medium text-foreground' : 'text-muted-foreground',
                )}
              >
                {label}
              </span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function Finish({ values, onGo }: { values: ProfileValues; onGo: () => void }) {
  useEffect(() => {
    const h = setTimeout(onGo, REDIRECT_MS)
    return () => clearTimeout(h)
  }, [onGo])
  return (
    <div className="finish-motion mx-auto flex max-w-md flex-col items-center py-6 text-center">
      <span className="flex size-20 animate-[pop-soft_0.5s_cubic-bezier(0.34,1.4,0.64,1)_both] items-center justify-center rounded-full bg-primary/12">
        <svg viewBox="0 0 24 24" className="size-10 text-primary" fill="none" aria-hidden>
          <path
            d="M5 12.5l4.5 4.5L19 7.5"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="animate-[draw-stroke_0.6s_0.25s_ease-out_forwards] [stroke-dasharray:24] [stroke-dashoffset:24]"
          />
        </svg>
      </span>
      <h1 className="mt-6 font-serif text-[34px] leading-tight tracking-[-0.015em]">
        {t.doneTitle}
      </h1>
      <p className="mt-2 text-muted-foreground">{t.doneText}</p>
      <BusinessCard values={values} className="mt-8 w-full text-left" />
      <div className="mt-8 flex w-full flex-col gap-2 sm:flex-row">
        <Button className="h-10 flex-1" nativeButton={false} render={<Link to="/faktury/nova" />}>
          <Sparkles /> {t.firstInvoice}
        </Button>
        <Button variant="outline" className="h-10 flex-1" onClick={onGo}>
          {t.toDashboard}
        </Button>
      </div>
      <div
        className="mt-6 h-1 w-40 overflow-hidden rounded-full bg-muted"
        role="presentation"
        aria-hidden
      >
        <div
          className="h-full origin-left animate-[fill-bar_4s_linear_forwards] rounded-full bg-primary/60"
          style={{ animationDuration: `${REDIRECT_MS}ms` }}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{t.redirecting}</p>
    </div>
  )
}

function Onboarding() {
  const navigate = useNavigate()
  const { data: profile } = useQuery(orpc.businessProfile.get.queryOptions())
  const appearance = useQuery(orpc.appearance.get.queryOptions({ input: {} }))
  const [values, setValues] = useState<ProfileValues | null>(null)
  const [saved, setSaved] = useState(false)
  const go = () => navigate({ to: '/prehled' })
  const step: 1 | 2 | 3 = saved
    ? 3
    : values && values.ico && values.legalName.trim() && values.street
      ? 2
      : 1

  return (
    <div className="min-h-svh">
      <header className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-6">
        <Logo name={BRAND.name} markClassName="size-8" />
        <Progress step={step} />
        <ThemeToggle labels={cs.theme} />
      </header>

      <main className="mx-auto max-w-5xl px-6 pt-6 pb-16 sm:pt-10">
        {saved && values ? (
          <Finish values={values} onGo={go} />
        ) : (
          <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,34rem)_minmax(0,1fr)] lg:gap-14">
            <div>
              <p className="label-caps mb-3">{t.stepOf(step, 3)}</p>
              <h1 className="font-serif text-[34px] leading-[1.1] tracking-[-0.015em] text-balance">
                {t.title}
              </h1>
              <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
                {t.description}
              </p>
              <div className="sheet mt-7 p-5 sm:p-6 [&_[data-slot=label]]:label-caps">
                {profile && (
                  <BusinessProfileForm
                    profile={profile}
                    submitLabel={t.submit}
                    onValuesChange={setValues}
                    onSaved={() => setSaved(true)}
                  />
                )}
                {profile && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="mt-2 w-full"
                    onClick={async () => {
                      // Finishing onboarding stamps onboardedAt; keep whatever is already stored.
                      await client.businessProfile.update({ legalName: profile.legalName })
                      await go()
                    }}
                  >
                    {t.skip}
                  </Button>
                )}
              </div>
            </div>

            <aside className="lg:sticky lg:top-8">
              <p className="label-caps mb-3">{t.previewLabel}</p>
              {values && (
                <BusinessCard
                  values={values}
                  logo={appearance.data?.logo ?? null}
                  accent={appearance.data?.accentColor ?? null}
                />
              )}
              <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">{t.aresHint}</p>
            </aside>
          </div>
        )}
      </main>
    </div>
  )
}
