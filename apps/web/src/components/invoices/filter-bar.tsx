import { NativeSelect } from '@fakturky/ui/components/native-select'
import { useIsMobile } from '@fakturky/ui/hooks/use-mobile'
import { useEffect, useRef, useState } from 'react'
import { SearchField } from '@/components/search-field'
import { cs } from '@/i18n/cs'
import { type DocType, TYPES } from './list-search'
import { type Period, PeriodFilter } from './period-filter'

const t = cs.invoices

/**
 * One quiet row: search (debounced into the URL), type and period, same fill and height.
 * On a phone the search takes the first line and the two selects share the second.
 * Remount with a new `key` to clear the typed term.
 */
export function FilterBar({
  q,
  type,
  from,
  to,
  onSearch,
  onType,
  onPeriod,
}: Period & {
  q: string | undefined
  type: DocType | undefined
  onSearch: (q: string | undefined) => void
  onType: (type: DocType | undefined) => void
  onPeriod: (period: Period) => void
}) {
  const isMobile = useIsMobile()
  const [term, setTerm] = useState(q ?? '')
  const lastSent = useRef(q ?? '')
  // The URL can change without typing (back button, palette): follow it instead of writing the old term back.
  useEffect(() => {
    if ((q ?? '') === lastSent.current) return
    lastSent.current = q ?? ''
    setTerm(q ?? '')
  }, [q])
  useEffect(() => {
    if ((q ?? '') === term) return
    const h = setTimeout(() => {
      lastSent.current = term
      onSearch(term || undefined)
    }, 250)
    return () => clearTimeout(h)
  }, [term, q, onSearch])

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <SearchField
        className="basis-full sm:max-w-sm sm:flex-1 sm:basis-0"
        placeholder={isMobile ? t.searchShort : t.search}
        value={term}
        onChange={(e) => setTerm(e.target.value)}
      />
      <NativeSelect
        className="flex-1 sm:w-44 sm:flex-none [&_select]:h-9 [&_select]:border-transparent [&_select]:bg-muted/60 pointer-coarse:[&_select]:h-11 dark:[&_select]:bg-muted/60"
        aria-label={t.columns.type}
        value={type ?? ''}
        onChange={(e) => onType(TYPES.find((x) => x === e.target.value))}
      >
        <option value="">{t.allTypes}</option>
        {TYPES.map((x) => (
          <option key={x} value={x}>
            {t.type[x]}
          </option>
        ))}
      </NativeSelect>
      <PeriodFilter from={from} to={to} onChange={onPeriod} />
    </div>
  )
}
