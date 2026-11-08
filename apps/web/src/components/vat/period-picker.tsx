import { formatDateCs } from '@fakturky/domain/dates'
import { Label } from '@fakturky/ui/components/label'
import { NativeSelect } from '@fakturky/ui/components/native-select'
import { cn } from '@fakturky/ui/lib/utils'
import { cs } from '@/i18n/cs'
import type { PeriodKind, VatOptions, VatPeriod } from './use-vat-report'

const t = cs.vat

/** Měsíc / Čtvrtletí switch. */
function KindSwitch({ kind, onChange }: { kind: PeriodKind; onChange: (k: PeriodKind) => void }) {
  return (
    <div role="radiogroup" aria-label={t.period} className="inline-flex rounded-lg bg-muted p-0.5">
      {(['month', 'quarter'] as const).map((k) => (
        <button
          key={k}
          type="button"
          role="radio"
          aria-checked={kind === k}
          onClick={() => onChange(k)}
          className={cn(
            'h-9 rounded-md px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
            kind === k
              ? 'bg-card text-foreground shadow-[0_0_0_1px_var(--border)]'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {k === 'month' ? t.monthly : t.quarterly}
        </button>
      ))}
    </div>
  )
}

/** Choosing the period is the first step of the page; the deadline for it sits beside the choice. */
export function PeriodPicker({
  period,
  options,
  deadline,
}: {
  period: VatPeriod
  options: VatOptions
  deadline: string | undefined
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-4">
        <KindSwitch kind={period.kind} onChange={period.setKind} />
        <div className="space-y-1.5">
          <Label htmlFor="vat-year" className="text-xs text-muted-foreground">
            {t.year}
          </Label>
          <NativeSelect
            id="vat-year"
            className="w-28"
            value={period.year}
            onChange={(e) => period.setYear(Number(e.target.value))}
          >
            {period.years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vat-idx" className="text-xs text-muted-foreground">
            {period.kind === 'month' ? t.monthly : t.quarterly}
          </Label>
          <NativeSelect
            id="vat-idx"
            className="w-44"
            value={period.idx}
            onChange={(e) => period.setIdx(Number(e.target.value))}
          >
            {period.kind === 'month'
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
        <div className="sm:ml-auto sm:text-right">
          <div className="text-xs text-muted-foreground">{t.deadline}</div>
          <div className="text-xl leading-7 tabular-nums">
            {deadline ? formatDateCs(deadline) : '…'}
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{t.deadlineHint}</p>

      <details className="group">
        <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm text-muted-foreground hover:text-foreground">
          {t.options.title}:{' '}
          {options.euSupplyKind === 'services' ? t.options.euServices : t.options.euGoods} ·{' '}
          {t.options.rcCodes[options.reverseChargeCode]}
        </summary>
        <div className="grid gap-4 pt-2 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="eu-kind" className="text-xs text-muted-foreground">
              {t.options.euKind}
            </Label>
            <NativeSelect
              id="eu-kind"
              value={options.euSupplyKind}
              onChange={(e) => options.setEuSupplyKind(e.target.value as 'services' | 'goods')}
            >
              <option value="services">{t.options.euServices}</option>
              <option value="goods">{t.options.euGoods}</option>
            </NativeSelect>
            <p className="text-xs text-muted-foreground">{t.options.euHint}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="rc-code" className="text-xs text-muted-foreground">
              {t.options.rcCode}
            </Label>
            <NativeSelect
              id="rc-code"
              value={options.reverseChargeCode}
              onChange={(e) => options.setReverseChargeCode(e.target.value)}
            >
              {Object.entries(t.options.rcCodes).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>
      </details>
    </div>
  )
}
