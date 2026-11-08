import type { RouterOutputs } from '@fakturky/core/router'
import { todayPrague } from '@fakturky/domain/dates'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { cs } from '@/i18n/cs'
import type { client } from '@/lib/orpc'
import { orpc } from '@/lib/orpc'
import { parseInputAmount } from '@/lib/parse-amount'

export type VatReport = RouterOutputs['vat']['report']
export type VatProfile = RouterOutputs['businessProfile']['get']
export type VatReportInput = Parameters<typeof client.vat.report>[0]

export type PeriodKind = 'month' | 'quarter'
export type ManualInput = {
  r40Base: string
  r40Deduction: string
  r41Base: string
  r41Deduction: string
}

/** The most recently finished period: what is due next. */
function previousPeriod(kind: PeriodKind, today: string) {
  const [y = 0, m = 1] = today.split('-').map(Number)
  if (kind === 'month') return m === 1 ? { year: y - 1, idx: 12 } : { year: y, idx: m - 1 }
  const q = Math.ceil(m / 3)
  return q === 1 ? { year: y - 1, idx: 4 } : { year: y, idx: q - 1 }
}

/**
 * Everything the VAT page chooses (period, EU/reverse-charge options, hand-entered input VAT) and the
 * report query that follows from it. Callers get values and setters; the query input stays in here.
 */
export function useVatReport(profile: VatProfile) {
  const today = todayPrague()
  const filingKind: PeriodKind = profile.vatFiling?.period === 'quarterly' ? 'quarter' : 'month'
  const [kind, setKindState] = useState<PeriodKind>(filingKind)
  const [{ year, idx }, setPeriod] = useState(() => previousPeriod(filingKind, today))
  const [euSupplyKind, setEuSupplyKind] = useState<'services' | 'goods'>('services')
  const [reverseChargeCode, setReverseChargeCode] = useState('4')
  const [manual, setManual] = useState<ManualInput>({
    r40Base: '',
    r40Deduction: '',
    r41Base: '',
    r41Deduction: '',
  })
  const [committed, setCommitted] = useState(manual)

  const currentYear = Number(today.slice(0, 4))
  const { inputVat, errors } = useMemo(() => {
    const out: Record<string, string> = {}
    const bad: Partial<Record<keyof ManualInput, true>> = {}
    for (const [k, v] of Object.entries(committed)) {
      const parsed = parseInputAmount(v)
      if (parsed === 'invalid') bad[k as keyof ManualInput] = true
      else if (parsed !== null) out[k] = parsed
    }
    return { inputVat: Object.keys(out).length ? out : undefined, errors: bad }
  }, [committed])

  const input: VatReportInput = {
    year,
    ...(kind === 'month' ? { month: idx } : { quarter: idx }),
    euSupplyKind,
    reverseChargeCode,
    ...(inputVat ? { inputVat } : {}),
  }
  const query = useQuery(orpc.vat.report.queryOptions({ input }))

  return {
    query,
    input,
    period: {
      kind,
      year,
      idx,
      years: [currentYear, currentYear - 1, currentYear - 2, currentYear - 3],
      label:
        kind === 'month' ? `${cs.vat.months[idx - 1]} ${year}` : `${cs.vat.quarter(idx)} ${year}`,
      setKind: (next: PeriodKind) => {
        setKindState(next)
        setPeriod(previousPeriod(next, today))
      },
      setYear: (y: number) => setPeriod({ year: y, idx }),
      setIdx: (i: number) => setPeriod({ year, idx: i }),
    },
    options: { euSupplyKind, setEuSupplyKind, reverseChargeCode, setReverseChargeCode },
    manual: { value: manual, set: setManual, commit: () => setCommitted(manual), errors },
  }
}

export type VatPeriod = ReturnType<typeof useVatReport>['period']
export type VatOptions = ReturnType<typeof useVatReport>['options']
export type VatManual = ReturnType<typeof useVatReport>['manual']
