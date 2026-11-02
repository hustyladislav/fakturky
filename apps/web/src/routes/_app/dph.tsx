import type { RouterOutputs } from '@fakturky/core/router'
import { formatDateCs, todayPrague } from '@fakturky/domain/dates'
import { Badge } from '@fakturky/ui/components/badge'
import { Button } from '@fakturky/ui/components/button'
import { EmptyState } from '@fakturky/ui/components/empty-state'
import { Input } from '@fakturky/ui/components/input'
import { Label } from '@fakturky/ui/components/label'
import { Money } from '@fakturky/ui/components/money'
import { NativeSelect } from '@fakturky/ui/components/native-select'
import { Skeleton } from '@fakturky/ui/components/skeleton'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Download, ExternalLink, Receipt, TriangleAlert } from 'lucide-react'
import { Fragment, useMemo, useState } from 'react'
import { toast } from 'sonner'
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

  if (profile.isPending) return <Skeleton className="mx-auto h-64 max-w-[1200px] rounded-xl" />
  if (profile.data?.vatStatus !== 'payer') {
    return (
      <div className="mx-auto max-w-[1200px] space-y-6">
        <h1 className="text-2xl font-semibold">{t.title}</h1>
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

  const switchKind = (next: PeriodKind) => {
    setKind(next)
    setPeriod(previousPeriod(next, today))
    setOpen(null)
  }

  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      <h1 className="text-2xl font-semibold">{t.title}</h1>

      <div
        role="note"
        className="rounded-xl border border-primary/30 bg-accent p-4 text-accent-foreground"
      >
        <p className="font-semibold">{t.disclaimer}</p>
        <p className="mt-1 text-sm">{t.disclaimerText}</p>
      </div>

      <section className="grid gap-4 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="vat-kind">{t.period}</Label>
          <NativeSelect
            id="vat-kind"
            value={kind}
            onChange={(e) => switchKind(e.target.value as PeriodKind)}
          >
            <option value="month">{t.monthly}</option>
            <option value="quarter">{t.quarterly}</option>
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="vat-year">{t.year}</Label>
          <NativeSelect
            id="vat-year"
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
        <div className="space-y-2">
          <Label htmlFor="vat-idx">{kind === 'month' ? t.monthly : t.quarterly}</Label>
          <NativeSelect
            id="vat-idx"
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
        <div className="space-y-1">
          <div className="text-sm font-medium">{t.deadline}</div>
          <div className="text-lg font-semibold">{r ? formatDateCs(r.deadline) : '…'}</div>
          <div className="text-xs text-muted-foreground">{t.deadlineHint}</div>
        </div>
      </section>

      <FilingCard profile={profile} />

      <section className="grid gap-4 rounded-xl border p-4 sm:grid-cols-2">
        <h2 className="font-semibold sm:col-span-2">{t.options.title}</h2>
        <div className="space-y-2">
          <Label htmlFor="eu-kind">{t.options.euKind}</Label>
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
          <Label htmlFor="rc-code">{t.options.rcCode}</Label>
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
      </section>

      {report.isError && <p className="text-sm text-destructive">{cs.common.error}</p>}
      {report.isPending && <Skeleton className="h-64 rounded-xl" aria-busy="true" />}

      {r && (
        <>
          {r.advisories.map((a) => (
            <p key={a} className="rounded-lg border p-3 text-sm">
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
    <section className="space-y-3 rounded-xl border p-4">
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
          <p className="text-sm text-muted-foreground sm:col-span-2">{t.filing.description}</p>
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
    <section className="space-y-2 rounded-xl border border-destructive/40 p-4">
      <h2 className="flex items-center gap-2 font-semibold">
        <TriangleAlert className="size-4" aria-hidden />
        {t.warnings.title}
      </h2>
      <ul className="space-y-2 text-sm">
        {report.warnings.map((w) => (
          <li key={`${w.code}-${w.documentId}`} className="flex flex-wrap items-baseline gap-2">
            <Badge variant={w.blocking ? 'destructive' : 'secondary'}>
              {w.blocking ? t.warnings.blocking : t.warnings.info}
            </Badge>
            <DocLink report={report} id={w.documentId} />
            <span>{t.warnings.codes[w.code] ?? w.code}</span>
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
    <div className="rounded-lg bg-muted/40 p-3">
      <div className="mb-2 text-xs font-medium text-muted-foreground">{t.drill.title}</div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.kh.none}</p>
      ) : (
        <table className="w-full text-sm">
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
    <section className="space-y-4 rounded-xl border p-4">
      <div>
        <h2 className="text-lg font-semibold">{t.dph.title}</h2>
        <p className="text-sm text-muted-foreground">{t.dph.description}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-2 pr-3 font-medium">{t.dph.row}</th>
              <th className="py-2 pr-3 font-medium" />
              <th className="py-2 pr-3 text-right font-medium">{t.dph.base}</th>
              <th className="py-2 pr-3 text-right font-medium">{t.dph.vat}</th>
              <th className="py-2 font-medium">{t.dph.docs}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <Fragment key={row.key}>
                <tr className="border-b">
                  <td className="py-2 pr-3 font-medium">{row.key}</td>
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
                {open === `dp3.${row.key}` && (
                  <tr>
                    <td colSpan={5} className="pb-3">
                      <Drill report={report} rowKey={`dp3.${row.key}`} />
                    </td>
                  </tr>
                )}
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
      <p className="text-xs text-muted-foreground">{t.dph.rounding}</p>

      <div className="space-y-3 rounded-lg border p-3">
        <h3 className="font-medium">{t.dph.inputTitle}</h3>
        <p className="text-sm text-muted-foreground">{t.dph.inputText}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t.dph.r40}</legend>
            <div className="grid grid-cols-2 gap-2">
              {field('r40Base', t.dph.inputBase)}
              {field('r40Deduction', t.dph.inputDeduction)}
            </div>
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t.dph.r41}</legend>
            <div className="grid grid-cols-2 gap-2">
              {field('r41Base', t.dph.inputBase)}
              {field('r41Deduction', t.dph.inputDeduction)}
            </div>
          </fieldset>
        </div>
      </div>

      <dl className="grid gap-3 sm:grid-cols-4">
        {[
          [t.dph.summaryOut, f.r62],
          [t.dph.summaryDeduction, f.r63],
          [t.dph.summaryPay, f.r64],
          [t.dph.summaryRefund, f.r65],
        ].map(([label, amount]) => (
          <div key={label} className="rounded-lg border p-3">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 text-lg font-semibold">
              <Money amount={amount as string} />
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
    <section className="space-y-4 rounded-xl border p-4">
      <div>
        <h2 className="text-lg font-semibold">{t.kh.title}</h2>
        <p className="text-sm text-muted-foreground">{t.kh.description}</p>
      </div>

      <div className="space-y-2">
        <h3 className="font-medium">{t.kh.a1}</h3>
        {a1.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.kh.none}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">{t.kh.document}</th>
                  <th className="py-2 pr-3 font-medium">{t.kh.dic}</th>
                  <th className="py-2 pr-3 font-medium">{t.kh.date}</th>
                  <th className="py-2 pr-3 font-medium">{t.kh.code}</th>
                  <th className="py-2 text-right font-medium">{t.dph.base}</th>
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
        <h3 className="font-medium">{t.kh.a4}</h3>
        {a4.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.kh.none}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">{t.kh.document}</th>
                  <th className="py-2 pr-3 font-medium">{t.kh.dic}</th>
                  <th className="py-2 pr-3 font-medium">{t.kh.date}</th>
                  <th className="py-2 pr-3 text-right font-medium">{t.kh.rate21}</th>
                  <th className="py-2 text-right font-medium">{t.kh.rate12}</th>
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
          <h3 className="font-medium">{t.kh.a5}</h3>
          <DrillButton rowKey="kh.A5" open={open} setOpen={setOpen} count={a5Count} />
        </div>
        {a5Empty ? (
          <p className="text-sm text-muted-foreground">{t.kh.none}</p>
        ) : (
          <dl className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border p-3">
              <dt className="text-xs text-muted-foreground">{t.kh.rate21}</dt>
              <dd>
                <Money amount={a5.base21} /> / <Money amount={a5.vat21} />
              </dd>
            </div>
            <div className="rounded-lg border p-3">
              <dt className="text-xs text-muted-foreground">{t.kh.rate12}</dt>
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
    <section className="space-y-3 rounded-xl border p-4">
      <div>
        <h2 className="text-lg font-semibold">{t.sh.title}</h2>
        <p className="text-sm text-muted-foreground">{t.sh.description}</p>
      </div>
      {report.sh.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.sh.none}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-3 font-medium">{t.sh.country}</th>
                <th className="py-2 pr-3 font-medium">{t.sh.vatId}</th>
                <th className="py-2 pr-3 font-medium">{t.sh.code}</th>
                <th className="py-2 pr-3 text-right font-medium">{t.sh.count}</th>
                <th className="py-2 text-right font-medium">{t.sh.value}</th>
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
    <section className="space-y-3 rounded-xl border p-4">
      <div>
        <h2 className="text-lg font-semibold">{t.downloads.title}</h2>
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
    <section className="space-y-3 rounded-xl border p-4">
      <h2 className="text-lg font-semibold">{t.guide.title}</h2>
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
