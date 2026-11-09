import { Amount } from '@fakturky/ui/components/amount'
import { FieldError } from '@fakturky/ui/components/field-error'
import { Input } from '@fakturky/ui/components/input'
import { Label } from '@fakturky/ui/components/label'
import { Money } from '@fakturky/ui/components/money'
import { cn } from '@fakturky/ui/lib/utils'
import { SettingsSection } from '@/components/settings/settings-section'
import { cs } from '@/i18n/cs'
import { Drill, DrillButton, type DrillState } from './drill'
import type { VatManual, VatReport } from './use-vat-report'

const t = cs.vat.dph

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

/** `exempt` is informational: not a return row, no number and no drill-down. */
type Row = { key: string; base: string; vat?: string }
const isExempt = (row: Row) => row.key === 'exempt'

function ManualInputVat({ manual }: { manual: VatManual }) {
  const field = (name: keyof typeof manual.value, label: string) => (
    <div className="space-y-1">
      <Label htmlFor={`m-${name}`} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Input
        id={`m-${name}`}
        inputMode="decimal"
        value={manual.value[name]}
        onChange={(e) => manual.set({ ...manual.value, [name]: e.target.value })}
        onBlur={manual.commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') manual.commit()
        }}
        aria-invalid={manual.errors[name] ? true : undefined}
        aria-describedby={manual.errors[name] ? `m-${name}-error` : undefined}
      />
      <FieldError id={`m-${name}-error`}>{manual.errors[name] ? t.inputInvalid : null}</FieldError>
    </div>
  )
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-medium">{t.inputTitle}</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">{t.inputText}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm">{t.r40}</legend>
          <div className="grid grid-cols-2 gap-2">
            {field('r40Base', t.inputBase)}
            {field('r40Deduction', t.inputDeduction)}
          </div>
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm">{t.r41}</legend>
          <div className="grid grid-cols-2 gap-2">
            {field('r41Base', t.inputBase)}
            {field('r41Deduction', t.inputDeduction)}
          </div>
        </fieldset>
      </div>
    </div>
  )
}

/** The totals the return ends in: tax payable is the figure to read first. */
function Totals({ f }: { f: Figures }) {
  const items: Array<{ label: string; amount: string; key?: boolean }> = [
    { label: t.summaryOut, amount: f.r62 },
    { label: t.summaryDeduction, amount: f.r63 },
    { label: t.summaryPay, amount: f.r64, key: true },
    { label: t.summaryRefund, amount: f.r65 },
  ]
  return (
    <dl className="grid gap-x-6 gap-y-5 border-y py-5 sm:grid-cols-2 @2xl:grid-cols-4">
      {items.map((i) => (
        <div key={i.label}>
          <dt
            className={cn(
              'text-xs',
              i.key ? 'font-medium text-foreground' : 'text-muted-foreground',
            )}
          >
            {i.label}
          </dt>
          <dd className="mt-1">
            <Amount value={i.amount} size="lg" />
          </dd>
        </div>
      ))}
    </dl>
  )
}

/** Přiznání k DPH: rows with their numbers in quiet text, then the hand-entered input VAT and totals. */
export function ReturnSection({
  report,
  drill,
  manual,
}: {
  report: VatReport
  drill: DrillState
  manual: VatManual
}) {
  const f = report.dp3Figures as unknown as Figures
  const rows: Row[] = [
    { key: '1', base: f.r1.base, vat: f.r1.vat },
    { key: '2', base: f.r2.base, vat: f.r2.vat },
    { key: '20', base: f.r20 },
    { key: '21', base: f.r21 },
    { key: '22', base: f.r22 },
    { key: '25', base: f.r25 },
    { key: '26', base: f.r26 },
  ]
  const count = (key: string) =>
    report.contributions.filter((c) => c.rowKey === `dp3.${key}`).length
  if (count('exempt') > 0)
    rows.push({ key: 'exempt', base: (report.dp3.exempt ?? { base: '0.00' }).base })

  return (
    <SettingsSection title={t.title} description={t.description} className="@container">
      <div className="space-y-6">
        <ul className="divide-y border-y sm:hidden">
          {rows.map((row) => (
            <li key={row.key} className="space-y-1.5 py-3">
              <div className="flex items-baseline gap-3">
                <span className="w-9 shrink-0 text-xs text-muted-foreground tabular-nums">
                  {isExempt(row) ? '' : row.key}
                </span>
                <span className={cn('text-sm', isExempt(row) && 'text-muted-foreground')}>
                  {t.rows[row.key]}
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 pl-12 text-sm">
                <span className="flex flex-wrap gap-x-3">
                  <span className="whitespace-nowrap">
                    <span className="text-muted-foreground">{t.base}: </span>
                    <Money amount={row.base} />
                  </span>
                  {row.vat !== undefined && (
                    <span className="whitespace-nowrap">
                      <span className="text-muted-foreground">{t.vat}: </span>
                      <Money amount={row.vat} />
                    </span>
                  )}
                </span>
                {!isExempt(row) && (
                  <DrillButton rowKey={`dp3.${row.key}`} count={count(row.key)} drill={drill} />
                )}
              </div>
            </li>
          ))}
        </ul>
        <div className="hidden sm:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th scope="col" className="w-12 pb-2 pr-3 font-normal">
                  {t.row}
                </th>
                <th scope="col" className="pb-2 pr-3" />
                <th scope="col" className="pb-2 pr-3 text-right font-normal">
                  {t.base}
                </th>
                <th scope="col" className="pb-2 pr-3 text-right font-normal">
                  {t.vat}
                </th>
                <th scope="col" className="pb-2 text-right font-normal">
                  {t.docs}
                </th>
              </tr>
            </thead>
            <tbody className="border-y">
              {rows.map((row) => (
                <tr
                  key={row.key}
                  className={cn('border-b last:border-0', isExempt(row) && 'text-muted-foreground')}
                >
                  <td className="py-2.5 pr-3 text-xs text-muted-foreground tabular-nums">
                    {isExempt(row) ? '' : row.key}
                  </td>
                  <td className="py-2.5 pr-3">{t.rows[row.key]}</td>
                  <td className="py-2.5 pr-3 text-right">
                    <Money amount={row.base} />
                  </td>
                  <td className="py-2.5 pr-3 text-right">
                    {row.vat !== undefined ? <Money amount={row.vat} /> : '–'}
                  </td>
                  <td className="py-1 text-right">
                    {!isExempt(row) && (
                      <DrillButton rowKey={`dp3.${row.key}`} count={count(row.key)} drill={drill} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {drill.open?.startsWith('dp3.') && <Drill report={report} rowKey={drill.open} />}
        <p className="text-xs text-muted-foreground">{t.rounding}</p>
        <ManualInputVat manual={manual} />
        <Totals f={f} />
      </div>
    </SettingsSection>
  )
}
