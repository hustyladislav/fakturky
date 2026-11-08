import { Input } from '@fakturky/ui/components/input'
import { NativeSelect } from '@fakturky/ui/components/native-select'
import { useIsMobile } from '@fakturky/ui/hooks/use-mobile'
import { Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { cs } from '@/i18n/cs'
import { type DocType, TYPES } from './list-search'

const t = cs.invoices

/**
 * One quiet row: search (debounced into the URL) and type, same fill and height.
 * Remount with a new `key` to clear the typed term.
 */
export function FilterBar({
  q,
  type,
  onSearch,
  onType,
}: {
  q: string | undefined
  type: DocType | undefined
  onSearch: (q: string | undefined) => void
  onType: (type: DocType | undefined) => void
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
    <div className="mb-3 flex items-center gap-2">
      <div className="relative min-w-0 flex-1 sm:max-w-sm">
        <Search
          className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          className="border-transparent bg-muted/60 pl-8 dark:bg-muted/60"
          placeholder={isMobile ? t.searchShort : t.search}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          aria-label={cs.common.search}
          enterKeyHint="search"
        />
      </div>
      <NativeSelect
        className="w-36 shrink-0 sm:w-52 [&_select]:h-9 [&_select]:border-transparent [&_select]:bg-muted/60 pointer-coarse:[&_select]:h-11 dark:[&_select]:bg-muted/60"
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
    </div>
  )
}
