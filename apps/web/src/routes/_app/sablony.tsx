import { formatDateCs } from '@fakturky/domain/dates'
import { Amount } from '@fakturky/ui/components/amount'
import { Badge } from '@fakturky/ui/components/badge'
import { Button } from '@fakturky/ui/components/button'
import { DatePicker } from '@fakturky/ui/components/date-picker'
import { EmptyState } from '@fakturky/ui/components/empty-state'
import { Input } from '@fakturky/ui/components/input'
import { Label } from '@fakturky/ui/components/label'
import { NativeSelect } from '@fakturky/ui/components/native-select'
import { PageHeader } from '@fakturky/ui/components/page-header'
import { RelativeDate } from '@fakturky/ui/components/relative-date'
import { Skeleton } from '@fakturky/ui/components/skeleton'
import { cn } from '@fakturky/ui/lib/utils'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { CalendarClock, Pause, Play, Repeat, Trash2, Zap } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { cs } from '@/i18n/cs'
import { pageHead } from '@/lib/head'
import { orpc } from '@/lib/orpc'

export const Route = createFileRoute('/_app/sablony')({
  head: pageHead(cs.templates.title),
  component: Templates,
})

const t = cs.templates

function Templates() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const templates = useQuery(orpc.templates.list.queryOptions({ input: {} }))
  const rules = useQuery(orpc.recurring.list.queryOptions({ input: {} }))
  const [repeatFor, setRepeatFor] = useState<string | null>(null)
  const [startOn, setStartOn] = useState('')
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: orpc.templates.key() })
    await queryClient.invalidateQueries({ queryKey: orpc.recurring.key() })
  }
  const onError = (e: unknown) => toast.error((e as Error).message || cs.common.error)

  const use = useMutation(
    orpc.templates.use.mutationOptions({
      onSuccess: async (d) => {
        toast.success(t.used)
        await queryClient.invalidateQueries({ queryKey: orpc.documents.key() })
        navigate({ to: '/faktury/$id/upravit', params: { id: d.id } })
      },
      onError,
    }),
  )
  const del = useMutation(
    orpc.templates.delete.mutationOptions({
      onSuccess: async () => {
        toast.success(t.deleted)
        await refresh()
      },
      onError,
    }),
  )
  const create = useMutation(
    orpc.recurring.create.mutationOptions({
      onSuccess: async () => {
        toast.success(t.ruleCreated)
        setRepeatFor(null)
        await refresh()
      },
      onError,
    }),
  )
  const update = useMutation(orpc.recurring.update.mutationOptions({ onSuccess: refresh, onError }))
  const delRule = useMutation(
    orpc.recurring.delete.mutationOptions({
      onSuccess: async () => {
        toast.success(t.ruleDeleted)
        await refresh()
      },
      onError,
    }),
  )

  const ruleByTemplate = new Map(rules.data?.map((r) => [r.templateId, r]))
  const tplCount = templates.data?.length ?? 0
  const activeRules = rules.data?.filter((r) => r.active).length ?? 0

  return (
    <div className="mx-auto max-w-[1280px] space-y-10 pb-20 sm:pb-0">
      <PageHeader
        title={t.title}
        subtitle={templates.data ? t.subtitle(tplCount, activeRules) : undefined}
      />

      {templates.isPending && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-72 rounded-xl" />
          ))}
        </div>
      )}
      {templates.data?.length === 0 && (
        <EmptyState illustration="templates" title={t.emptyTitle}>
          {t.empty}
        </EmptyState>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {templates.data?.map((tpl) => {
          const rule = ruleByTemplate.get(tpl.id)
          const currency = tpl.body.currency ?? 'CZK'
          const net = tpl.body.lines.reduce(
            (sum, l) => sum + Number(l.quantity) * Number(l.unitPrice),
            0,
          )
          const showForm = repeatFor === tpl.id
          return (
            <article key={tpl.id} className="sheet flex flex-col overflow-hidden">
              <MiniPaper lines={tpl.body.lines} currency={currency} net={net} />
              <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
                <div>
                  <h2 className="font-serif text-lg leading-6 font-medium">{tpl.name}</h2>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[13px] text-muted-foreground">
                    <span>{t.lines(tpl.body.lines.length)}</span>
                    <span aria-hidden>·</span>
                    <span>
                      <Amount value={net.toFixed(2)} currency={currency} size="sm" /> {t.net}
                    </span>
                  </p>
                </div>

                {rule ? (
                  <p
                    className={cn(
                      'flex items-center gap-2 rounded-lg px-3 py-2 text-[13px]',
                      rule.active
                        ? 'bg-primary/[0.07] text-foreground'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    <Repeat className="size-4 shrink-0 text-primary" aria-hidden />
                    <span className="min-w-0">
                      <span className="font-medium">{t.frequency[rule.frequency]}</span>
                      {rule.active ? (
                        <>
                          {' · '}
                          {t.nextShort}{' '}
                          <RelativeDate date={rule.nextRunOn} className="font-medium" />
                        </>
                      ) : (
                        ` · ${t.paused}`
                      )}
                    </span>
                  </p>
                ) : null}

                <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
                  <Button size="sm" onClick={() => use.mutate({ id: tpl.id })}>
                    {t.use}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setStartOn('')
                      setRepeatFor(showForm ? null : tpl.id)
                    }}
                  >
                    {t.repeat}
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="ml-auto text-muted-foreground"
                    aria-label={`${t.delete}: ${tpl.name}`}
                    onClick={() => del.mutate({ id: tpl.id })}
                  >
                    <Trash2 />
                  </Button>
                </div>

                {showForm && (
                  <form
                    className="grid gap-3 border-t pt-4"
                    onSubmit={(e) => {
                      e.preventDefault()
                      const f = new FormData(e.currentTarget)
                      create.mutate({
                        templateId: tpl.id,
                        frequency: f.get('frequency') as 'monthly' | 'quarterly' | 'yearly',
                        dayOfMonth: Number(f.get('day')),
                        startOn: startOn || undefined,
                        autoIssue: f.get('autoIssue') === 'on',
                        autoSend: f.get('autoSend') === 'on',
                      })
                    }}
                  >
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor={`fr-${tpl.id}`} className="label-caps">
                          {t.repeat}
                        </Label>
                        <NativeSelect id={`fr-${tpl.id}`} name="frequency">
                          {Object.entries(t.frequency).map(([k, v]) => (
                            <option key={k} value={k}>
                              {v}
                            </option>
                          ))}
                        </NativeSelect>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`d-${tpl.id}`} className="label-caps">
                          {t.day}
                        </Label>
                        <Input
                          id={`d-${tpl.id}`}
                          name="day"
                          type="number"
                          min={1}
                          max={31}
                          defaultValue={1}
                          className="text-right tabular-nums"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`s-${tpl.id}`} className="label-caps">
                        {t.startOn}
                      </Label>
                      <DatePicker
                        id={`s-${tpl.id}`}
                        value={startOn}
                        onChange={setStartOn}
                        placeholder={t.today}
                        aria-label={t.startOn}
                      />
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="autoIssue" /> {t.autoIssue}
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="autoSend" /> {t.autoSend}
                    </label>
                    <div className="flex gap-2">
                      <Button type="submit" size="sm" disabled={create.isPending}>
                        {t.createRule}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setRepeatFor(null)}
                      >
                        {cs.common.cancel}
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            </article>
          )
        })}
      </div>

      <section className="space-y-3">
        <h2 className="label-caps flex items-center gap-2 border-b pb-2 font-sans text-foreground">
          <CalendarClock className="size-3.5" aria-hidden />
          {t.recurringTitle}
        </h2>
        {rules.data?.length === 0 && (
          <p className="py-2 text-sm text-muted-foreground">{t.recurringEmpty}</p>
        )}
        {rules.data && rules.data.length > 0 && (
          <ul className="sheet divide-y overflow-hidden">
            {rules.data.map((r) => (
              <li
                key={r.id}
                className="row-hover flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 sm:px-5"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Repeat className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2 font-medium">
                    {r.templateName}
                    <Badge variant="secondary">{t.frequency[r.frequency]}</Badge>
                    {!r.active && <Badge variant="outline">{t.paused}</Badge>}
                    {r.autoIssue && (
                      <span className="inline-flex items-center gap-1 text-xs font-normal text-muted-foreground">
                        <Zap className="size-3" aria-hidden />{' '}
                        {r.autoSend ? t.autoSendShort : t.autoIssueShort}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {t.nextRun}: <RelativeDate date={r.nextRunOn} />{' '}
                    <span className="tabular-nums">({formatDateCs(r.nextRunOn)})</span>
                  </div>
                </div>
                <div className="row-actions flex gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => update.mutate({ id: r.id, active: !r.active })}
                  >
                    {r.active ? <Pause /> : <Play />}
                    {r.active ? t.pause : t.resume}
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="text-muted-foreground"
                    aria-label={`${t.delete}: ${r.templateName}`}
                    onClick={() => delRule.mutate({ id: r.id })}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

/** A tiny paper thumbnail of the template (always light, like the invoice itself). */
function MiniPaper({
  lines,
  currency,
  net,
}: {
  lines: { description: string; quantity: string; unitPrice: string }[]
  currency: string
  net: number
}) {
  const shown = lines.slice(0, 3)
  return (
    <div className="bg-muted/60 px-5 pt-5" aria-hidden>
      <div className="mx-auto h-36 max-w-[17rem] overflow-hidden rounded-t-[3px] bg-white px-4 pt-3.5 text-[#1b1a17] shadow-[0_0_0_1px_var(--border),0_8px_20px_-10px_rgb(0_0_0/0.25)]">
        <div className="flex items-center justify-between">
          <span className="h-1.5 w-14 rounded-full bg-[#1b1a17]/80" />
          <span className="h-1.5 w-8 rounded-full bg-[#1b1a17]/30" />
        </div>
        <div className="mt-2 h-px bg-[#1f4d3c]" />
        <div className="mt-2.5 space-y-1.5">
          {shown.map((l, i) => (
            <div
              key={`${i}-${l.description}`}
              className="flex items-center justify-between gap-3 text-[9px] leading-none"
            >
              <span className="truncate">{l.description}</span>
              <span className="shrink-0 text-[#6b665b] tabular-nums">
                {(Number(l.quantity) * Number(l.unitPrice)).toLocaleString('cs-CZ', {
                  maximumFractionDigits: 0,
                })}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-baseline justify-between border-t border-[#d6cdba] pt-2">
          <span className="text-[7px] font-semibold tracking-widest text-[#6b665b] uppercase">
            {currency}
          </span>
          <span className="font-serif text-sm font-medium tabular-nums">
            {net.toLocaleString('cs-CZ', { maximumFractionDigits: 0 })}
          </span>
        </div>
      </div>
    </div>
  )
}
