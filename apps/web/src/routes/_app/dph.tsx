import type { RouterOutputs } from '@fakturky/core/router'
import { formatDateCs, todayPrague } from '@fakturky/domain/dates'
import { Amount } from '@fakturky/ui/components/amount'
import { Badge } from '@fakturky/ui/components/badge'
import { Button } from '@fakturky/ui/components/button'
import { EmptyState } from '@fakturky/ui/components/empty-state'
import { Input } from '@fakturky/ui/components/input'
import { Label } from '@fakturky/ui/components/label'
import { Money } from '@fakturky/ui/components/money'
import { NativeSelect } from '@fakturky/ui/components/native-select'
import { PageHeader } from '@fakturky/ui/components/page-header'
import { Skeleton } from '@fakturky/ui/components/skeleton'
import { cn } from '@fakturky/ui/lib/utils'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Download, ExternalLink, Info, Receipt, TriangleAlert } from 'lucide-react'
import { Fragment, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ErrorState } from '@/components/error-state'
import { cs } from '@/i18n/cs'
import { pageHead } from '@/lib/head'
import { client, orpc } from '@/lib/orpc'

export const Route = createFileRoute('/_app/dph')({
  head: pageHead(cs.nav.vat),
  component: VatPage,
})

const t = cs.vat

type Report = RouterOutputs['vat']['report']
type Figures = {
  r1: { base: string; vat: string }
  r2: { base: string; vat: string }
  r20: string
  r21: string
  r22: string
  r25: string
  r26: string
  r62: string
  r63: string
  r64: string
  r65: string
}

const AMOUNT = /^-?\d+([.,]\d{1,2})?$/

type PeriodKind = 'month' | 'quarter'

/** The most recently finished period: what is due next. */
function previousPeriod(kind: PeriodKind, today: string) {
  const [y = 0, m = 1] = today.split('-').map(Number)
  if (kind === 'month') return m === 1 ? { year: y - 1, idx: 12 } : { year: y, idx: m - 1 }
  const q = Math.ceil(m / 3)
  return q === 1 ? { year: y - 1, idx: 4 } : { year: y, idx: q - 1 }
}

function downloadXml(f: { filename: string; xml: string }) {
  const url = URL.createObjectURL(new Blob([f.xml], { type: 'application/xml;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = f.filename
  a.click()
  URL.revokeObjectURL(url)
}

function VatPage() {
  const profile = useQuery(orpc.businessProfile.get.queryOptions())

  if (profile.isPending) {
    return (
      <div className="mx-auto max-w-[1200px] space-y-4" aria-busy="true">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }
  if (profile.isError) {
    return (
      <div className="mx-auto max-w-[1200px] space-y-6">
        <PageHeader title={t.title} />
        <ErrorState onRetry={() => profile.refetch()} />
      </div>
    )
  }
  if (profile.data?.vatStatus !== 'payer') {
    return (
      <div className="mx-auto max-w-[1200px] space-y-6">
        <PageHeader title={t.title} />
        <EmptyState icon={Receipt} title={t.notPayerTitle}>
          {t.notPayerText}
        </EmptyState>
        <div className="flex justify-center">
          <Button nativeButton={false} variant="outline" render={<Link to="/nastaveni" />}>
            {t.notPayerCta}
          </Button>
        </div>
      </div>
    )
  }
  return <PayerPage profile={profile.data} />
}

type Profile = RouterOutputs['businessProfile']['get']

function PayerPage({ profile }: { profile: Profile }) {
  const filingPeriod = profile.vatFiling?.period ?? 'monthly'
  const [kind, setKind] = useState<PeriodKind>(filingPeriod === 'quarterly' ? 'quarter' : 'month')
  const today = todayPrague()
  const [{ year, idx }, setPeriod] = useState(() => previousPeriod(kind, today))
  const [euSupplyKind, setEuSupplyKind] = useState<'services' | 'goods'>('services')
  const [reverseChargeCode, setRcCode] = useState('4')
  const [manual, setManual] = useState({
    r40Base: '',
    r40Deduction: '',
    r41Base: '',
    r41Deduction: '',
  })
  const [committed, setCommitted] = useState(manual)
  const [open, setOpen] = useState<string | null>(null)

  const currentYear = Number(today.slice(0, 4))
  const years = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3]

  const inputVat = useMemo(() => {
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(committed)) if (AMOUNT.test(v.trim())) out[k] = v.trim()
    return Object.keys(out).length ? out : undefined
  }, [committed])

  const input = {
    year,
    ...(kind === 'month' ? { month: idx } : { quarter: idx }),
    euSupplyKind,
    reverseChargeCode,
    ...(inputVat ? { inputVat } : {}),
  }
  const report = useQuery(orpc.vat.report.queryOptions({ input }))
  const r = report.data

  const periodLabel =
    kind === 'month' ? `${t.months[idx - 1]} ${year}` : `${t.quarter(idx)} ${year}`

  const switchKind = (next: PeriodKind) => {
    setKind(next)
    setPeriod(previousPeriod(next, today))
    setOpen(null)
  }

  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      <PageHeader
        title={t.title}
        subtitle={r ? t.subtitle(periodLabel, formatDateCs(r.deadline)) : undefined}
        actions={
          <div
            role="radiogroup"
            aria-label={t.period}
            className="inline-flex rounded-lg bg-muted p-0.5"
          >
            {(['month', 'quarter'] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => switchKind(k)}
                className={cn(
                  'h-8 rounded-md px-3.5 text-sm font-medium transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                  kind === k
                    ? 'bg-card text-foreground shadow-[0_0_0_1px_var(--border),0_1px_2px_rgb(0_0_0/0.06)]'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {k === 'month' ? t.monthly : t.quarterly}
              </button>
            ))}
          </div>
        }
      />

      <div
        role="note"
        className="flex items-start gap-3 rounded-xl bg-info/10 px-4 py-3 text-sm text-foreground"
      >
        <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
        <p>
          <span className="font-semibold">{t.disclaimer}</span>{' '}
          <span className="text-muted-foreground">{t.disclaimerText}</span>
        </p>
      </div>

      <section className="sheet flex flex-wrap items-end gap-x-5 gap-y-3 p-4 sm:px-6">
        <div className="space-y-1.5">
          <Label htmlFor="vat-year" className="label-caps">
            {t.year}
          </Label>
          <NativeSelect
            id="vat-year"
            className="w-28"
            value={year}
            onChange={(e) => setPeriod({ year: Number(e.target.value), idx })}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vat-idx" className="label-caps">
            {kind === 'month' ? t.monthly : t.quarterly}
          </Label>
          <NativeSelect
            id="vat-idx"
            className="w-44"
            value={idx}
            onChange={(e) => setPeriod({ year, idx: Number(e.target.value) })}
          >
            {kind === 'month'
              ? t.months.map((name, i) => (
                  <option key={name} value={i + 1}>
                    {i + 1}. {name}
                  </option>
                ))
              : [1, 2, 3, 4].map((q) => (
                  <option key={q} value={q}>
                    {t.quarter(q)}
                  </option>
                ))}
          </NativeSelect>
        </div>
        <div className="ml-auto text-right">
          <div className="label-caps">{t.deadline}</div>
          <div className="font-serif text-2xl leading-8 tabular-nums">
            {r ? formatDateCs(r.deadline) : '…'}
          </div>
          <div className="text-xs text-muted-foreground">{t.deadlineHint}</div>
        </div>
        <div className="hairline grid w-full gap-4 pt-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="eu-kind" className="label-caps">
              {t.options.euKind}
            </Label>
            <NativeSelect
              id="eu-kind"
              value={euSupplyKind}
              onChange={(e) => setEuSupplyKind(e.target.value as 'services' | 'goods')}
            >
              <option value="services">{t.options.euServices}</option>
              <option value="goods">{t.options.euGoods}</option>
            </NativeSelect>
            <p className="text-xs text-muted-foreground">{t.options.euHint}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="rc-code" className="label-caps">
              {t.options.rcCode}
            </Label>
            <NativeSelect
              id="rc-code"
              value={reverseChargeCode}
              onChange={(e) => setRcCode(e.target.value)}
            >
              {Object.entries(t.options.rcCodes).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>
      </section>

      <FilingCard profile={profile} />

      {report.isError && <ErrorState onRetry={() => report.refetch()} />}
      {report.isPending && <Skeleton className="h-64 rounded-xl" aria-busy="true" />}

      {r && (
        <>
          {r.advisories.map((a) => (
            <p key={a} className="flex items-start gap-3 rounded-xl bg-info/10 px-4 py-3 text-sm">
              <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
              {t.advisories[a] ?? a}
            </p>
          ))}
          <Warnings report={r} />
          <DphSection
            report={r}
            open={open}
            setOpen={setOpen}
            manual={manual}
            setManual={setManual}
            commit={() => setCommitted(manual)}
          />
          <KhSection report={r} open={open} setOpen={setOpen} />
          <ShSection report={r} />
          <Downloads input={input} report={r} />
          <Guide />
        </>
      )}
    </div>
  )
}

function FilingCard({ profile }: { profile: Profile }) {
  const queryClient = useQueryClient()
  const f = profile.vatFiling
  const [editing, setEditing] = useState(false)
  const [taxOfficeCode, setCode] = useState(f?.taxOfficeCode ?? '')
  const [workplaceCode, setWorkplace] = useState(f?.workplaceCode ?? '')
  const [subjectType, setType] = useState<'F' | 'P'>(f?.subjectType ?? 'F')
  const [period, setPeriodKind] = useState<'monthly' | 'quarterly'>(f?.period ?? 'monthly')
  const [error, setError] = useState<string | null>(null)
  const save = useMutation(
    orpc.businessProfile.update.mutationOptions({
      onSuccess: async () => {
        toast.success(t.filing.saved)
        setEditing(false)
        await queryClient.invalidateQueries({ queryKey: orpc.businessProfile.key() })
        await queryClient.invalidateQueries({ queryKey: orpc.vat.key() })
      },
      onError: (e) => toast.error((e as Error).message || cs.common.error),
    }),
  )
  const complete = Boolean(f) && Boolean(profile.dic)
  const show = editing || !complete

  return (
    <section className="space-y-3 sheet p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">{t.filing.title}</h2>
        {complete && !editing && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            {t.filing.edit}
          </Button>
        )}
      </div>
      {!profile.dic && (
        <p className="text-sm text-destructive">
          {t.filing.missingDic}{' '}
          <Link to="/nastaveni" className="underline">
            {t.filing.profileLink}
          </Link>
        </p>
      )}
      {!f && <p className="text-sm text-muted-foreground">{t.filing.missingFiling}</p>}
      {complete && !editing && f && (
        <p className="text-sm text-muted-foreground">
          {profile.dic} · {t.filing.taxOfficeCode}: {f.taxOfficeCode}
          {f.workplaceCode ? `/${f.workplaceCode}` : ''} ·{' '}
          {f.subjectType === 'F' ? t.filing.personF : t.filing.personP} ·{' '}
          {f.period === 'monthly' ? t.monthly : t.quarterly}
        </p>
      )}
      {show && (
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!/^\d{3}$/.test(taxOfficeCode)) {
              setError(t.filing.invalidCode)
              return
            }
            setError(null)
            save.mutate({
              vatFiling: {
                taxOfficeCode,
                workplaceCode: workplaceCode || null,
                period,
                subjectType,
              },
            })
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="uf-code">{t.filing.taxOfficeCode}</Label>
            <Input
              id="uf-code"
              inputMode="numeric"
              maxLength={3}
              value={taxOfficeCode}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              aria-describedby="uf-hint"
            />
            <p id="uf-hint" className="text-xs text-muted-foreground">
              {error ?? t.filing.taxOfficeHint}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="uf-work">{t.filing.workplaceCode}</Label>
            <Input
              id="uf-work"
              inputMode="numeric"
              maxLength={4}
              value={workplaceCode}
              onChange={(e) => setWorkplace(e.target.value.replace(/\D/g, ''))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="uf-type">{t.filing.subjectType}</Label>
            <NativeSelect
              id="uf-type"
              value={subjectType}
              onChange={(e) => setType(e.target.value as 'F' | 'P')}
            >
              <option value="F">{t.filing.personF}</option>
              <option value="P">{t.filing.personP}</option>
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor="uf-period">{t.filing.periodLabel}</Label>
            <NativeSelect
              id="uf-period"
              value={period}
              onChange={(e) => setPeriodKind(e.target.value as 'monthly' | 'quarterly')}
            >
              <option value="monthly">{t.monthly}</option>
              <option value="quarterly">{t.quarterly}</option>
            </NativeSelect>
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={save.isPending}>
              {t.filing.save}
            </Button>
          </div>
        </form>
      )}
    </section>
  )
}

function DocLink({ report, id }: { report: Report; id: string }) {
  const d = report.documents[id]
  if (!d) return null
  return (
    <Link to="/faktury/$id" params={{ id }} className="underline">
      {d.number}
    </Link>
  )
}

function Warnings({ report }: { report: Report }) {
  if (report.warnings.length === 0) return null
  return (
    <section className="space-y-2" aria-label={t.warnings.title}>
      <h2 className="label-caps flex items-center gap-2 text-foreground">
        <TriangleAlert className="size-3.5" aria-hidden />
        {t.warnings.title}
      </h2>
      <ul className="space-y-2 text-sm">
        {report.warnings.map((w) => (
          <li
            key={`${w.code}-${w.documentId}`}
            className={cn(
              'flex items-start gap-3 rounded-xl px-4 py-3',
              w.blocking ? 'bg-destructive/10' : 'bg-warning/12',
            )}
          >
            <TriangleAlert
              className={cn(
                'mt-0.5 size-4 shrink-0',
                w.blocking ? 'text-destructive' : 'text-warning',
              )}
              aria-hidden
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={w.blocking ? 'destructive' : 'secondary'}>
                  {w.blocking ? t.warnings.blocking : t.warnings.info}
                </Badge>
                <span className="font-serif tabular-nums">
                  <DocLink report={report} id={w.documentId} />
                </span>
              </div>
              <p className="mt-1">{t.warnings.codes[w.code] ?? w.code}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Documents behind a row (drill-down). */
function Drill({ report, rowKey }: { report: Report; rowKey: string }) {
  const rows = report.contributions.filter((c) => c.rowKey === rowKey)
  return (
    <div className="rounded-xl bg-muted/60 p-3.5">
      <div className="label-caps mb-2">{t.drill.title}</div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.kh.none}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[30rem] text-sm">
            <tbody>
              {rows.map((c) => {
                const d = report.documents[c.documentId]
                return (
                  <tr key={`${c.rowKey}-${c.documentId}`} className="border-b last:border-0">
                    <td className="py-1 pr-3">
                      <DocLink report={report} id={c.documentId} />
                    </td>
                    <td className="py-1 pr-3">{d ? formatDateCs(d.taxableDate) : ''}</td>
                    <td className="py-1 pr-3">{d?.customerName}</td>
                    <td className="py-1 pr-3 text-right">
                      <Money amount={c.base} />
                    </td>
                    <td className="py-1 text-right">
                      <Money amount={c.vat} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function DrillButton({
  rowKey,
  open,
  setOpen,
  count,
}: {
  rowKey: string
  open: string | null
  setOpen: (k: string | null) => void
  count: number
}) {
  const isOpen = open === rowKey
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-expanded={isOpen}
      disabled={count === 0}
      onClick={() => setOpen(isOpen ? null : rowKey)}
    >
      {count === 0 ? '–' : t.documents(count)}
    </Button>
  )
}

function DphSection({
  report,
  open,
  setOpen,
  manual,
  setManual,
  commit,
}: {
  report: Report
  open: string | null
  setOpen: (k: string | null) => void
  manual: { r40Base: string; r40Deduction: string; r41Base: string; r41Deduction: string }
  setManual: (m: {
    r40Base: string
    r40Deduction: string
    r41Base: string
    r41Deduction: string
  }) => void
  commit: () => void
}) {
  const f = report.dp3Figures as unknown as Figures
  const rows: Array<{
    key: string
    whole: string
    base?: string
    vat?: string
    amountOnly: boolean
  }> = [
    { key: '1', whole: f.r1.base, base: f.r1.base, vat: f.r1.vat, amountOnly: false },
    { key: '2', whole: f.r2.base, base: f.r2.base, vat: f.r2.vat, amountOnly: false },
    { key: '20', whole: f.r20, amountOnly: true },
    { key: '21', whole: f.r21, amountOnly: true },
    { key: '22', whole: f.r22, amountOnly: true },
    { key: '25', whole: f.r25, amountOnly: true },
    { key: '26', whole: f.r26, amountOnly: true },
  ]
  const exempt = report.dp3.exempt ?? { base: '0.00', vat: '0.00' }
  const count = (key: string) =>
    report.contributions.filter((c) => c.rowKey === `dp3.${key}`).length
  const field = (name: keyof typeof manual, label: string) => (
    <div className="space-y-1">
      <Label htmlFor={`m-${name}`} className="text-xs">
        {label}
      </Label>
      <Input
        id={`m-${name}`}
        inputMode="decimal"
        value={manual[name]}
        onChange={(e) => setManual({ ...manual, [name]: e.target.value })}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
        }}
      />
    </div>
  )

  return (
    <section className="@container space-y-4 sheet p-5 sm:p-7">
      <div>
        <h2 className="font-serif text-xl">{t.dph.title}</h2>
        <p className="text-sm text-muted-foreground">{t.dph.description}</p>
      </div>
      <ul className="divide-y border-y sm:hidden">
        {rows.map((row) => (
          <li key={row.key} className="space-y-1.5 py-3">
            <div className="flex items-baseline gap-2">
              <span className="label-caps">
                {t.dph.row} {row.key}
              </span>
              <span className="text-muted-foreground text-sm">{t.dph.rows[row.key]}</span>
            </div>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="flex flex-wrap gap-x-3">
                <span className="whitespace-nowrap">
                  <span className="text-muted-foreground">{t.dph.base}: </span>
                  <Money amount={row.whole} />
                </span>
                {row.vat !== undefined && (
                  <span className="whitespace-nowrap">
                    <span className="text-muted-foreground">{t.dph.vat}: </span>
                    <Money amount={row.vat} />
                  </span>
                )}
              </span>
              <DrillButton
                rowKey={`dp3.${row.key}`}
                open={open}
                setOpen={setOpen}
                count={count(row.key)}
              />
            </div>
          </li>
        ))}
      </ul>
      <div className="-mx-4 hidden overflow-x-auto px-4 sm:block">
        <table className="w-full min-w-[34rem] text-sm">
          <thead>
            <tr className="hairline-b text-left">
              <th className="label-caps py-2 pr-3">{t.dph.row}</th>
              <th className="py-2 pr-3" />
              <th className="label-caps py-2 pr-3 text-right">{t.dph.base}</th>
              <th className="label-caps py-2 pr-3 text-right">{t.dph.vat}</th>
              <th className="label-caps py-2">{t.dph.docs}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <Fragment key={row.key}>
                <tr className="border-b">
                  <td className="py-2.5 pr-3">
                    <span className="inline-flex h-6 min-w-8 items-center justify-center rounded-md bg-muted px-1.5 text-xs font-semibold text-muted-foreground tabular-nums">
                      {row.key}
                    </span>
                  </td>
                  <td className="py-2 pr-3">{t.dph.rows[row.key]}</td>
                  <td className="py-2 pr-3 text-right">
                    <Money amount={row.whole} />
                  </td>
                  <td className="py-2 pr-3 text-right">
                    {row.vat !== undefined ? <Money amount={row.vat} /> : '–'}
                  </td>
                  <td className="py-2">
                    <DrillButton
                      rowKey={`dp3.${row.key}`}
                      open={open}
                      setOpen={setOpen}
                      count={count(row.key)}
                    />
                  </td>
                </tr>
              </Fragment>
            ))}
            {count('exempt') > 0 && (
              <tr className="border-b text-muted-foreground">
                <td className="py-2 pr-3" />
                <td className="py-2 pr-3">{t.dph.rows.exempt}</td>
                <td className="py-2 pr-3 text-right">
                  <Money amount={exempt.base} />
                </td>
                <td className="py-2 pr-3" />
                <td className="py-2" />
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {open?.startsWith('dp3.') && <Drill report={report} rowKey={open} />}
      <p className="text-xs text-muted-foreground">{t.dph.rounding}</p>

      <div className="space-y-3 rounded-xl border border-dashed p-4">
        <h3 className="label-caps text-foreground">{t.dph.inputTitle}</h3>
        <p className="text-sm text-muted-foreground">{t.dph.inputText}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-medium">{t.dph.r40}</legend>
            <div className="grid grid-cols-2 gap-2">
              {field('r40Base', t.dph.inputBase)}
              {field('r40Deduction', t.dph.inputDeduction)}
            </div>
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-medium">{t.dph.r41}</legend>
            <div className="grid grid-cols-2 gap-2">
              {field('r41Base', t.dph.inputBase)}
              {field('r41Deduction', t.dph.inputDeduction)}
            </div>
          </fieldset>
        </div>
      </div>

      <dl className="grid overflow-hidden rounded-xl bg-muted/60 @2xl:grid-cols-4 @2xl:divide-x">
        {[
          [t.dph.summaryOut, f.r62, false],
          [t.dph.summaryDeduction, f.r63, false],
          [t.dph.summaryPay, f.r64, true],
          [t.dph.summaryRefund, f.r65, false],
        ].map(([label, amount, key]) => (
          <div
            key={label as string}
            className={cn('border-b p-4 last:border-0 @2xl:border-b-0', key && 'bg-card')}
          >
            <dt className="label-caps">{label}</dt>
            <dd className="mt-1.5">
              <Amount value={amount as string} size="lg" />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function KhSection({
  report,
  open,
  setOpen,
}: {
  report: Report
  open: string | null
  setOpen: (k: string | null) => void
}) {
  const { a1, a4, a5 } = report.kh
  const a5Count = report.contributions.filter((c) => c.rowKey === 'kh.A5').length
  const a5Empty = ['base21', 'vat21', 'base12', 'vat12'].every(
    (k) => Number(a5[k as keyof typeof a5]) === 0,
  )
  return (
    <section className="space-y-4 sheet p-5 sm:p-7">
      <div>
        <h2 className="font-serif text-xl">{t.kh.title}</h2>
        <p className="text-sm text-muted-foreground">{t.kh.description}</p>
      </div>

      <div className="space-y-2">
        <h3 className="label-caps text-foreground">{t.kh.a1}</h3>
        {a1.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.kh.none}</p>
        ) : (
          <div className="-mx-4 overflow-x-auto px-4">
            <table className="w-full min-w-[30rem] text-sm">
              <thead>
                <tr className="hairline-b text-left">
                  <th className="label-caps py-2 pr-3">{t.kh.document}</th>
                  <th className="label-caps py-2 pr-3">{t.kh.dic}</th>
                  <th className="label-caps py-2 pr-3">{t.kh.date}</th>
                  <th className="label-caps py-2 pr-3">{t.kh.code}</th>
                  <th className="label-caps py-2 text-right">{t.dph.base}</th>
                </tr>
              </thead>
              <tbody>
                {a1.map((x) => (
                  <tr key={x.documentId} className="border-b last:border-0">
                    <td className="py-2 pr-3">
                      <DocLink report={report} id={x.documentId} />
                    </td>
                    <td className="py-2 pr-3">{x.dicOdb}</td>
                    <td className="py-2 pr-3">{formatDateCs(x.duzp)}</td>
                    <td className="py-2 pr-3">{x.code}</td>
                    <td className="py-2 text-right">
                      <Money amount={x.base} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="label-caps text-foreground">{t.kh.a4}</h3>
        {a4.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.kh.none}</p>
        ) : (
          <div className="-mx-4 overflow-x-auto px-4">
            <table className="w-full min-w-[44rem] text-sm">
              <thead>
                <tr className="hairline-b text-left">
                  <th className="label-caps py-2 pr-3">{t.kh.document}</th>
                  <th className="label-caps py-2 pr-3">{t.kh.dic}</th>
                  <th className="label-caps py-2 pr-3">{t.kh.date}</th>
                  <th className="label-caps py-2 pr-3 text-right">{t.kh.rate21}</th>
                  <th className="label-caps py-2 text-right">{t.kh.rate12}</th>
                </tr>
              </thead>
              <tbody>
                {a4.map((x) => (
                  <tr key={x.documentId} className="border-b last:border-0">
                    <td className="py-2 pr-3">
                      <DocLink report={report} id={x.documentId} />
                    </td>
                    <td className="py-2 pr-3">{x.dicOdb}</td>
                    <td className="py-2 pr-3">{formatDateCs(x.dppd)}</td>
                    <td className="py-2 pr-3 text-right">
                      <Money amount={x.base21} /> / <Money amount={x.vat21} />
                    </td>
                    <td className="py-2 text-right">
                      <Money amount={x.base12} /> / <Money amount={x.vat12} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="label-caps text-foreground">{t.kh.a5}</h3>
          <DrillButton rowKey="kh.A5" open={open} setOpen={setOpen} count={a5Count} />
        </div>
        {a5Empty ? (
          <p className="text-sm text-muted-foreground">{t.kh.none}</p>
        ) : (
          <dl className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-muted/60 p-3.5">
              <dt className="label-caps">{t.kh.rate21}</dt>
              <dd>
                <Money amount={a5.base21} /> / <Money amount={a5.vat21} />
              </dd>
            </div>
            <div className="rounded-xl bg-muted/60 p-3.5">
              <dt className="label-caps">{t.kh.rate12}</dt>
              <dd>
                <Money amount={a5.base12} /> / <Money amount={a5.vat12} />
              </dd>
            </div>
          </dl>
        )}
        {open === 'kh.A5' && <Drill report={report} rowKey="kh.A5" />}
      </div>
      <p className="text-xs text-muted-foreground">{t.kh.notIncluded}</p>
    </section>
  )
}

function ShSection({ report }: { report: Report }) {
  return (
    <section className="space-y-3 sheet p-5 sm:p-7">
      <div>
        <h2 className="font-serif text-xl">{t.sh.title}</h2>
        <p className="text-sm text-muted-foreground">{t.sh.description}</p>
      </div>
      {report.sh.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.sh.none}</p>
      ) : (
        <div className="-mx-4 overflow-x-auto px-4">
          <table className="w-full min-w-[26rem] text-sm">
            <thead>
              <tr className="hairline-b text-left">
                <th className="label-caps py-2 pr-3">{t.sh.country}</th>
                <th className="label-caps py-2 pr-3">{t.sh.vatId}</th>
                <th className="label-caps py-2 pr-3">{t.sh.code}</th>
                <th className="label-caps py-2 pr-3 text-right">{t.sh.count}</th>
                <th className="label-caps py-2 text-right">{t.sh.value}</th>
              </tr>
            </thead>
            <tbody>
              {report.sh.map((x) => (
                <tr key={`${x.country}${x.vatNumber}${x.code}`} className="border-b last:border-0">
                  <td className="py-2 pr-3">{x.country}</td>
                  <td className="py-2 pr-3">{x.vatNumber}</td>
                  <td className="py-2 pr-3">{x.code === '0' ? t.sh.code0 : t.sh.code3}</td>
                  <td className="py-2 pr-3 text-right">{x.count}</td>
                  <td className="py-2 text-right">
                    <Money amount={x.valueWhole} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function Downloads({
  input,
  report,
}: {
  input: Parameters<typeof client.vat.report>[0]
  report: Report
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const get = async (kind: 'dp3' | 'kh' | 'sh') => {
    setBusy(kind)
    try {
      downloadXml(await client.vat.exportXml({ ...input, kind }))
    } catch (e) {
      toast.error((e as Error).message || t.downloads.error)
    } finally {
      setBusy(null)
    }
  }
  return (
    <section className="space-y-3 sheet p-5 sm:p-7">
      <div>
        <h2 className="font-serif text-xl">{t.downloads.title}</h2>
        <p className="text-sm text-muted-foreground">{t.downloads.description}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {(['dp3', 'kh', 'sh'] as const).map((kind) => (
          <Button
            key={kind}
            variant="outline"
            disabled={!report.filing.ready || busy !== null}
            onClick={() => get(kind)}
          >
            <Download aria-hidden /> {t.downloads[kind]}
          </Button>
        ))}
      </div>
      {!report.filing.ready && (
        <p className="text-sm text-muted-foreground">{t.downloads.needFiling}</p>
      )}
    </section>
  )
}

function Guide() {
  return (
    <section className="space-y-3 sheet p-5 sm:p-7">
      <h2 className="font-serif text-xl">{t.guide.title}</h2>
      <ol className="list-decimal space-y-1 pl-5 text-sm">
        {t.guide.steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      <Button
        nativeButton={false}
        variant="outline"
        render={<a href="https://www.mojedane.cz" target="_blank" rel="noreferrer" />}
      >
        <ExternalLink aria-hidden /> {t.guide.link}
      </Button>
    </section>
  )
}
