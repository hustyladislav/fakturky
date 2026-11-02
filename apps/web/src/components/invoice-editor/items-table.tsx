import type { VatTreatment } from '@fakturky/domain/vat'
import { Button } from '@fakturky/ui/components/button'
import { Input } from '@fakturky/ui/components/input'
import { Money } from '@fakturky/ui/components/money'
import { NativeSelect } from '@fakturky/ui/components/native-select'
import { cn } from '@fakturky/ui/lib/utils'
import { GripVertical, Plus, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { cs } from '@/i18n/cs'
import type { FormLine } from '@/lib/document-sheet'

const t = cs.invoices.form

export type Line = FormLine & { key: number }

export const VAT_RATES = ['21', '12']
export const TREATMENTS = [
  'exempt',
  'reverse_charge',
  'eu_reverse_charge',
  'export',
  'outside_scope',
] as const

let lineKey = 1
export const nextLineKey = () => lineKey++
export const emptyLine = (vatRate = '21'): Line => ({
  key: lineKey++,
  description: '',
  quantity: '1',
  unit: 'ks',
  unitPrice: '',
  vatRate,
  vatTreatment: 'standard',
  vatNote: '',
})

function move<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item as T)
  return next
}

/** Standard rates plus the VAT regimes; there is no 0 % rate in Czech VAT. */
function VatSelect({
  line,
  onChange,
}: {
  line: Line
  onChange: (patch: Pick<Line, 'vatRate' | 'vatTreatment'>) => void
}) {
  const value = line.vatTreatment === 'standard' ? line.vatRate : line.vatTreatment
  const shown = VAT_RATES.includes(value)
    ? `${value} %`
    : cs.invoices.vatTreatment[value as keyof typeof cs.invoices.vatTreatment]
  return (
    <NativeSelect
      aria-label={t.vatRate}
      title={shown}
      value={value}
      onChange={(e) => {
        const v = e.target.value
        if (VAT_RATES.includes(v)) onChange({ vatRate: v, vatTreatment: 'standard' })
        else onChange({ vatRate: '0', vatTreatment: v as VatTreatment })
      }}
    >
      {VAT_RATES.map((r) => (
        <option key={r} value={r}>
          {r} %
        </option>
      ))}
      {TREATMENTS.map((x) => (
        <option key={x} value={x}>
          {cs.invoices.vatTreatment[x]}
        </option>
      ))}
    </NativeSelect>
  )
}

/** Mini column label shown only in the stacked (narrow) layout; the table layout has real headers. */
function Tiny({ children }: { children: string }) {
  return (
    <span aria-hidden className="label-caps mb-1 block @[38rem]:hidden">
      {children}
    </span>
  )
}

/**
 * The invoice's items as a table: column headers, per-row totals, drag (or Alt + arrows) to reorder,
 * Enter adds a row, Ctrl/⌘ + Backspace removes one. Below ~640 px of its own width the rows stack.
 */
export function ItemsTable({
  lines,
  onChange,
  vatPayer,
  rowTotals,
  currency,
  newLine,
}: {
  lines: Line[]
  onChange: (lines: Line[]) => void
  vatPayer: boolean
  /** Net (or, without VAT, gross) total per line, aligned with `lines`; undefined while unparsable. */
  rowTotals: (string | undefined)[]
  currency: string
  newLine: () => Line
}) {
  // Description inputs by line key (no key in the markup: the counter differs between server and client).
  const descInputs = useRef(new Map<number, HTMLInputElement>())
  const pendingFocus = useRef<number | null>(null)
  const [dragKey, setDragKey] = useState<number | null>(null)
  const [overKey, setOverKey] = useState<number | null>(null)
  const [after, setAfter] = useState(false)

  const setLine = (key: number, patch: Partial<Line>) =>
    onChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)))

  const addLine = () => {
    const l = newLine()
    pendingFocus.current = l.key
    onChange([...lines, l])
  }

  // Focus the description of a row that was just added (after React has put it in the DOM).
  useEffect(() => {
    if (pendingFocus.current === null) return
    descInputs.current.get(pendingFocus.current)?.focus()
    pendingFocus.current = null
  }, [lines])

  const focusDesc = (key: number) => descInputs.current.get(key)?.focus()

  const remove = (key: number) => {
    if (lines.length === 1) return
    const i = lines.findIndex((l) => l.key === key)
    const neighbour = lines[i + 1] ?? lines[i - 1]
    if (neighbour) pendingFocus.current = neighbour.key
    onChange(lines.filter((l) => l.key !== key))
  }

  function onRowKeyDown(e: React.KeyboardEvent, i: number, key: number) {
    const mod = e.metaKey || e.ctrlKey
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault()
      const to = e.key === 'ArrowUp' ? i - 1 : i + 1
      if (to >= 0 && to < lines.length) onChange(move(lines, i, to))
      return
    }
    if (mod && e.key === 'Backspace') {
      e.preventDefault()
      remove(key)
      return
    }
    const target = e.target as HTMLElement
    if (
      e.key === 'Enter' &&
      !mod &&
      !e.altKey &&
      !e.nativeEvent.isComposing &&
      target.tagName === 'INPUT'
    ) {
      e.preventDefault()
      const next = lines[i + 1]
      if (next) focusDesc(next.key)
      else addLine()
    }
  }

  const hasRegime = vatPayer && lines.some((l) => l.vatTreatment !== 'standard')
  const cols = vatPayer
    ? `1.25rem minmax(8rem,1fr) 4.25rem 2.75rem 5.5rem ${hasRegime ? '11rem' : '5rem'} 6rem 1.75rem`
    : '1.25rem minmax(8rem,1fr) 4.25rem 2.75rem 5.5rem 6rem 1.75rem'

  return (
    <div className="@container" role="group" aria-label={t.items}>
      <div
        aria-hidden
        className="label-caps hidden gap-x-1.5 pb-2 @[38rem]:grid"
        style={{ gridTemplateColumns: cols }}
      >
        <span />
        <span>{t.description}</span>
        <span className="text-right">{t.quantity}</span>
        <span className="pl-1.5">{t.unit}</span>
        <span className="text-right">{t.unitPriceShort}</span>
        {vatPayer && <span>{t.vatRate}</span>}
        <span className="text-right">{vatPayer ? t.subtotal : t.lineTotal}</span>
        <span />
      </div>

      <ol className="divide-y divide-border border-y">
        {lines.map((l, i) => {
          const total = rowTotals[i]
          return (
            <li
              key={l.key}
              onKeyDown={(e) => onRowKeyDown(e, i, l.key)}
              onDragOver={(e) => {
                if (dragKey === null) return
                e.preventDefault()
                const rect = e.currentTarget.getBoundingClientRect()
                setOverKey(l.key)
                setAfter(e.clientY > rect.top + rect.height / 2)
              }}
              onDrop={(e) => {
                e.preventDefault()
                if (dragKey === null || dragKey === l.key) return
                const from = lines.findIndex((x) => x.key === dragKey)
                let to = i + (after ? 1 : 0)
                if (from < to) to -= 1
                onChange(move(lines, from, to))
                setDragKey(null)
                setOverKey(null)
              }}
              className={cn(
                'relative grid grid-cols-6 gap-x-1.5 gap-y-2 py-3 transition-colors @[38rem]:items-center @[38rem]:py-2 @[38rem]:[grid-template-columns:var(--cols)]',
                dragKey === l.key && 'opacity-40',
                overKey === l.key &&
                  dragKey !== l.key &&
                  (after
                    ? 'shadow-[inset_0_-2px_0_var(--primary)]'
                    : 'shadow-[inset_0_2px_0_var(--primary)]'),
              )}
              style={{ '--cols': cols } as React.CSSProperties}
            >
              <button
                type="button"
                draggable
                aria-label={t.moveLine}
                title={t.moveLineHint}
                disabled={lines.length === 1}
                onDragStart={(e) => {
                  const row = e.currentTarget.closest('li')
                  if (row) e.dataTransfer.setDragImage(row, 16, 16)
                  e.dataTransfer.effectAllowed = 'move'
                  e.dataTransfer.setData('text/plain', String(l.key))
                  setDragKey(l.key)
                }}
                onDragEnd={() => {
                  setDragKey(null)
                  setOverKey(null)
                }}
                className="hidden size-5 cursor-grab items-center justify-center rounded text-muted-foreground/60 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing disabled:pointer-events-none disabled:opacity-30 @[38rem]:flex"
              >
                <GripVertical className="size-4" aria-hidden />
              </button>

              <div className="col-span-6 @[38rem]:col-span-1">
                <Input
                  ref={(el: HTMLInputElement | null) => {
                    if (el) descInputs.current.set(l.key, el)
                    else descInputs.current.delete(l.key)
                  }}
                  aria-label={t.description}
                  placeholder={t.description}
                  value={l.description}
                  onChange={(e) => setLine(l.key, { description: e.target.value })}
                />
              </div>
              <div className="col-span-2 @[38rem]:col-span-1">
                <Tiny>{t.quantity}</Tiny>
                <Input
                  aria-label={t.quantity}
                  inputMode="decimal"
                  className="text-right tabular-nums"
                  value={l.quantity}
                  onChange={(e) => setLine(l.key, { quantity: e.target.value })}
                />
              </div>
              <div className="col-span-1 @[38rem]:col-span-1">
                <Tiny>{t.unit}</Tiny>
                <Input
                  aria-label={t.unit}
                  value={l.unit}
                  onChange={(e) => setLine(l.key, { unit: e.target.value })}
                />
              </div>
              <div className="col-span-3 @[38rem]:col-span-1">
                <Tiny>{t.unitPriceShort}</Tiny>
                <Input
                  aria-label={t.unitPrice}
                  placeholder="0,00"
                  inputMode="decimal"
                  className="text-right tabular-nums"
                  value={l.unitPrice}
                  onChange={(e) => setLine(l.key, { unitPrice: e.target.value })}
                />
              </div>
              {vatPayer && (
                <div className="col-span-3 @[38rem]:col-span-1">
                  <Tiny>{t.vatRate}</Tiny>
                  <VatSelect line={l} onChange={(patch) => setLine(l.key, patch)} />
                </div>
              )}
              <div
                className={cn(
                  'self-end text-right font-medium text-sm tabular-nums @[38rem]:col-span-1 @[38rem]:self-center',
                  vatPayer ? 'col-span-2' : 'col-span-5',
                )}
              >
                {total !== undefined ? (
                  <Money amount={total} currency={currency} />
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>
              <div className="col-span-1 flex justify-end self-end @[38rem]:self-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t.removeLine}
                  disabled={lines.length === 1}
                  onClick={() => remove(l.key)}
                  className="text-muted-foreground"
                >
                  <Trash2 />
                </Button>
              </div>
              {vatPayer && l.vatTreatment === 'exempt' && (
                <div className="col-span-6 @[38rem]:col-start-2 @[38rem]:col-end-[-1]">
                  <Input
                    aria-label={t.vatNote}
                    placeholder={t.vatNotePlaceholder}
                    value={l.vatNote}
                    onChange={(e) => setLine(l.key, { vatNote: e.target.value })}
                  />
                </div>
              )}
            </li>
          )
        })}
      </ol>

      <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={addLine}>
        <Plus /> {t.addLine}
      </Button>
    </div>
  )
}
