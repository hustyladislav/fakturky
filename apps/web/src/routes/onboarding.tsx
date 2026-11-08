import { BRAND } from '@fakturky/core/brand'
import { Button } from '@fakturky/ui/components/button'
import { Logo } from '@fakturky/ui/components/logo'
import { ThemeToggle } from '@fakturky/ui/components/theme'
import { cn } from '@fakturky/ui/lib/utils'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { QuickAccountForm } from '@/components/bank/quick-account-form'
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

type Step = 1 | 2 | 3

/** 1 Firma -> 2 Bankovní účet -> 3 Hotovo: a hairline per step, filled up to the current one. */
function Progress({ step }: { step: Step }) {
  return (
    <ol className="flex w-24 gap-1 sm:w-40" aria-label={t.progressLabel}>
      {t.steps.map((label, i) => (
        <li
          key={label}
          aria-current={i + 1 === step ? 'step' : undefined}
          className={cn(
            'h-0.5 flex-1 rounded-full transition-colors duration-200 ease-out',
            i + 1 <= step ? 'bg-primary' : 'bg-border',
          )}
        >
          <span className="sr-only">{label}</span>
        </li>
      ))}
    </ol>
  )
}

function Finish({ values, onGo }: { values: ProfileValues; onGo: () => void }) {
  // React's autoFocus skips anchors; Enter should go straight to the first invoice.
  const firstInvoice = useRef<HTMLButtonElement>(null)
  useEffect(() => firstInvoice.current?.focus(), [])
  return (
    <div className="finish-motion mx-auto flex max-w-md flex-col items-center py-6 text-center">
      <span className="flex size-20 animate-[pop-soft_0.5s_cubic-bezier(0.34,1.4,0.64,1)_both] items-center justify-center rounded-full bg-primary text-primary-foreground">
        <svg viewBox="0 0 24 24" className="size-10" fill="none" aria-hidden>
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
      <h1 className="mt-6 text-[28px] leading-8 font-normal tracking-[-0.02em]">{t.doneTitle}</h1>
      <p className="mt-2 text-muted-foreground">{t.doneText}</p>
      <BusinessCard values={values} className="mt-8 w-full text-left" />
      <div className="mt-8 flex w-full flex-col gap-2 sm:flex-row">
        <Button
          ref={firstInvoice}
          variant="brand"
          size="lg"
          className="h-11 flex-1"
          nativeButton={false}
          render={<Link to="/faktury/nova" />}
        >
          {t.firstInvoice}
        </Button>
        <Button variant="ghost" size="lg" className="h-11 flex-1" onClick={onGo}>
          {t.toDashboard}
        </Button>
      </div>
    </div>
  )
}

/** Step 3: first bank account, so the very first invoice carries a QR payment. Skippable. */
function BankStep({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient()
  const done = async () => {
    await queryClient.invalidateQueries({ queryKey: orpc.bankAccounts.key() })
    onDone()
  }
  return (
    <div>
      <p className="text-[13px] text-muted-foreground">{t.stepOf(2, 3)}</p>
      <h1 className="mt-2 text-[28px] leading-8 font-normal tracking-[-0.02em] text-balance">
        {t.bankTitle}
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{t.bankDescription}</p>
      <div className="mt-7">
        <QuickAccountForm autoFocus onCreated={done} onSkip={onDone} />
      </div>
    </div>
  )
}

function Onboarding() {
  const navigate = useNavigate()
  const { data: profile } = useQuery(orpc.businessProfile.get.queryOptions())
  const [values, setValues] = useState<ProfileValues | null>(null)
  const [saved, setSaved] = useState(false)
  const [bankDone, setBankDone] = useState(false)
  const go = () => navigate({ to: '/prehled' })
  const step: Step = saved ? (bankDone ? 3 : 2) : 1

  return (
    <div className="min-h-svh">
      <header className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-5 sm:px-6">
        <Logo name={BRAND.name} markClassName="size-7" />
        <Progress step={step} />
        <ThemeToggle labels={cs.theme} />
      </header>

      <main className="mx-auto max-w-5xl px-5 pt-6 pb-[max(4rem,env(safe-area-inset-bottom))] sm:px-6 sm:pt-12">
        {saved && values && bankDone ? (
          <Finish values={values} onGo={go} />
        ) : saved ? (
          <div className="mx-auto max-w-md">
            <BankStep onDone={() => setBankDone(true)} />
          </div>
        ) : (
          <div className="mx-auto max-w-md">
            <p className="text-[13px] text-muted-foreground">{t.stepOf(1, 3)}</p>
            <h1 className="mt-2 text-[28px] leading-8 font-normal tracking-[-0.02em] text-balance">
              {t.title}
            </h1>
            <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
              {t.description}
            </p>
            <div className="mt-7">
              {profile && (
                <BusinessProfileForm
                  mode="ico-first"
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
                  className="mt-2 h-11 w-full text-muted-foreground"
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
        )}
      </main>
    </div>
  )
}
