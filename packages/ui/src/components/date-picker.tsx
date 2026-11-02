import { cn } from 'cn'
import { CalendarDays } from 'lucide-react'
import { useState } from 'react'
import { addDays, formatDate, parseIsoDate, startOfDay, toIsoDate } from '../lib/dates'
import { Calendar } from './calendar'
import { Popover, PopoverContent, PopoverTrigger } from './popover'

export interface DatePreset {
  label: string
  /** Days added to the base date. */
  days: number
}

const defaultPresets: DatePreset[] = [
  { label: '7 dní', days: 7 },
  { label: '14 dní', days: 14 },
  { label: '30 dní', days: 30 },
]

/**
 * Date field for `YYYY-MM-DD` values: Popover + Czech calendar (Monday first) and optional
 * "7 / 14 / 30 dní" presets relative to `presetBase` (e.g. the issue date, for due dates).
 */
function DatePicker({
  value,
  onChange,
  presets,
  presetBase,
  placeholder = 'Vyberte datum',
  id,
  disabled,
  className,
  ...aria
}: {
  value: string | null | undefined
  onChange: (value: string) => void
  /** `true` shows 7/14/30 days; pass an array for custom ones. */
  presets?: boolean | DatePreset[]
  /** Base date for presets (`YYYY-MM-DD`); defaults to today. */
  presetBase?: string | null
  placeholder?: string
  id?: string
  disabled?: boolean
  className?: string
  'aria-label'?: string
  'aria-invalid'?: boolean
}) {
  const [open, setOpen] = useState(false)
  const selected = parseIsoDate(value)
  const list = presets === true ? defaultPresets : presets || []
  const base = parseIsoDate(presetBase) ?? startOfDay(new Date())
  const pick = (d: Date) => {
    onChange(toIsoDate(d))
    setOpen(false)
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        id={id}
        disabled={disabled}
        className={cn(
          'flex h-8 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-2.5 text-left text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-[invalid=true]:border-destructive md:text-sm dark:bg-input/30',
          !selected && 'text-muted-foreground',
          className,
        )}
        {...aria}
      >
        <span className="tabular-nums">{selected ? formatDate(selected) : placeholder}</span>
        <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3">
        {list.length > 0 && (
          <div className="mb-2 flex items-center gap-2">
            <span className="label-caps">Za</span>
            <div role="group" className="flex rounded-lg bg-muted p-0.5">
              {list.map((p) => {
                const target = addDays(base, p.days)
                const active = !!selected && toIsoDate(target) === toIsoDate(selected)
                return (
                  <button
                    key={p.days}
                    type="button"
                    aria-pressed={active}
                    onClick={() => pick(target)}
                    className={cn(
                      'h-6 rounded-md px-2.5 text-xs font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50',
                      active && 'sheet !rounded-md text-foreground',
                    )}
                  >
                    {p.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}
        <Calendar
          mode="single"
          selected={selected ?? undefined}
          defaultMonth={selected ?? base}
          onSelect={(d) => d && pick(d)}
        />
      </PopoverContent>
    </Popover>
  )
}

export { DatePicker }
