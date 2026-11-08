import { type PeriodPreset, periodPreset, todayPrague } from '@fakturky/domain/dates'
import { DatePicker } from '@fakturky/ui/components/date-picker'
import { NativeSelect } from '@fakturky/ui/components/native-select'
import { useState } from 'react'
import { cs } from '@/i18n/cs'

const t = cs.invoices.period

const PRESETS = [
  'thisMonth',
  'lastMonth',
  'thisQuarter',
  'thisYear',
] as const satisfies readonly PeriodPreset[]

export interface Period {
  from: string | undefined
  to: string | undefined
}

/** Which preset the bounds spell out today (Prague calendar), if any. */
function matchPreset({ from, to }: Period): PeriodPreset | null {
  const today = todayPrague()
  return (
    PRESETS.find((p) => from === periodPreset(p, today).from && to === periodPreset(p, today).to) ??
    null
  )
}

const field = 'h-9 border-transparent bg-muted/60 pointer-coarse:h-11 dark:bg-muted/60'

/**
 * "Období" select with presets plus "Vlastní" (two date pickers on their own line beneath).
 * Renders into the filter row's flex-wrap container; the period itself lives in the URL.
 */
export function PeriodFilter({
  from,
  to,
  onChange,
}: Period & { onChange: (period: Period) => void }) {
  const matched = matchPreset({ from, to })
  const hasPeriod = !!(from || to)
  const [custom, setCustom] = useState(hasPeriod && !matched)
  const showCustom = hasPeriod && (custom || !matched)
  const value = showCustom ? 'custom' : (matched ?? '')

  const pick = (next: string) => {
    if (next === 'custom') {
      setCustom(true)
      if (!hasPeriod) onChange(periodPreset('thisMonth'))
      return
    }
    setCustom(false)
    const preset = PRESETS.find((p) => p === next)
    onChange(preset ? periodPreset(preset) : { from: undefined, to: undefined })
  }

  // Keep the range ordered: moving one end past the other drags the other along.
  const setFrom = (v: string) => onChange({ from: v, to: to && to < v ? v : to })
  const setTo = (v: string) => onChange({ from: from && from > v ? v : from, to: v })

  return (
    <>
      <NativeSelect
        className={`flex-1 sm:w-44 sm:flex-none [&_select]:h-9 [&_select]:border-transparent [&_select]:bg-muted/60 pointer-coarse:[&_select]:h-11 dark:[&_select]:bg-muted/60`}
        aria-label={t.label}
        value={value}
        onChange={(e) => pick(e.target.value)}
      >
        <option value="">{t.all}</option>
        {PRESETS.map((p) => (
          <option key={p} value={p}>
            {t[p]}
          </option>
        ))}
        <option value="custom">{t.custom}</option>
      </NativeSelect>
      {showCustom && (
        <div className="flex basis-full items-center gap-2 text-sm text-muted-foreground">
          <span>{t.from}</span>
          <DatePicker
            className={`min-w-0 flex-1 sm:w-40 sm:flex-none ${field}`}
            aria-label={t.from}
            placeholder={t.pickDate}
            value={from}
            onChange={setFrom}
          />
          <span>{t.to}</span>
          <DatePicker
            className={`min-w-0 flex-1 sm:w-40 sm:flex-none ${field}`}
            aria-label={t.to}
            placeholder={t.pickDate}
            value={to}
            onChange={setTo}
          />
        </div>
      )}
    </>
  )
}
