import { firstOccurrence, formatDateCs, todayPrague } from '@fakturky/domain/dates'
import { Button } from '@fakturky/ui/components/button'
import { DatePicker } from '@fakturky/ui/components/date-picker'
import { Input } from '@fakturky/ui/components/input'
import { Label } from '@fakturky/ui/components/label'
import { NativeSelect } from '@fakturky/ui/components/native-select'
import { cn } from '@fakturky/ui/lib/utils'
import { useState } from 'react'
import { cs } from '@/i18n/cs'

const t = cs.templates

export type RuleValues = {
  frequency: 'monthly' | 'quarterly' | 'yearly'
  dayOfMonth: number
  startOn: string | undefined
  autoIssue: boolean
  autoSend: boolean
}

/** Recurrence form that spells out when the first automatic invoice appears and whether it is sent. */
export function RepeatForm({
  templateId,
  pending,
  onCancel,
  onSubmit,
}: {
  templateId: string
  pending: boolean
  onCancel: () => void
  onSubmit: (v: RuleValues) => void
}) {
  const [frequency, setFrequency] = useState<RuleValues['frequency']>('monthly')
  const [day, setDay] = useState('1')
  const [startOn, setStartOn] = useState('')
  const [autoIssue, setAutoIssue] = useState(false)
  const [autoSend, setAutoSend] = useState(false)
  const dayOfMonth = Math.min(31, Math.max(1, Number(day) || 1))
  const today = todayPrague()
  const first = firstOccurrence(startOn || today, dayOfMonth)
  return (
    <form
      className="grid max-w-md gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({
          frequency,
          dayOfMonth,
          startOn: startOn || undefined,
          autoIssue,
          autoSend: autoIssue && autoSend,
        })
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`fr-${templateId}`} className="text-[13px] text-muted-foreground">
            {t.repeat}
          </Label>
          <NativeSelect
            id={`fr-${templateId}`}
            name="frequency"
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as RuleValues['frequency'])}
          >
            {Object.entries(t.frequency).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`d-${templateId}`} className="text-[13px] text-muted-foreground">
            {t.day}
          </Label>
          <Input
            id={`d-${templateId}`}
            name="day"
            type="number"
            inputMode="numeric"
            min={1}
            max={31}
            value={day}
            onChange={(e) => setDay(e.target.value)}
            className="text-right tabular-nums"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`s-${templateId}`} className="text-[13px] text-muted-foreground">
          {t.startOn}
        </Label>
        <DatePicker
          id={`s-${templateId}`}
          value={startOn}
          onChange={setStartOn}
          placeholder={t.today}
          aria-label={t.startOn}
        />
      </div>
      <label className="flex min-h-9 items-center gap-2 text-sm pointer-coarse:min-h-11">
        <input
          type="checkbox"
          checked={autoIssue}
          onChange={(e) => setAutoIssue(e.target.checked)}
        />{' '}
        {t.autoIssue}
      </label>
      <label
        className={cn(
          'flex min-h-9 items-center gap-2 text-sm pointer-coarse:min-h-11',
          !autoIssue && 'text-muted-foreground',
        )}
      >
        <input
          type="checkbox"
          checked={autoIssue && autoSend}
          disabled={!autoIssue}
          onChange={(e) => setAutoSend(e.target.checked)}
        />{' '}
        {t.autoSend}
      </label>
      <p
        className="border-l-2 pl-3 text-[13px] leading-5 text-muted-foreground"
        aria-live="polite"
        data-testid="repeat-summary"
      >
        {first > today ? t.firstRunOn(formatDateCs(first)) : t.firstRunNext}{' '}
        {autoIssue ? (autoSend ? t.runIssueSend : t.runIssueOnly) : t.runDraftOnly}
      </p>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {t.createRule}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {cs.common.cancel}
        </Button>
      </div>
    </form>
  )
}
