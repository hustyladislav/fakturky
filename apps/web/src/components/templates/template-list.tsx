import type { RouterOutputs } from '@fakturky/core/router'
import { parseDecimal, sum, toFixed } from '@fakturky/domain'
import { formatDateCs } from '@fakturky/domain/dates'
import { Amount } from '@fakturky/ui/components/amount'
import { Button } from '@fakturky/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@fakturky/ui/components/dropdown-menu'
import { RelativeDate } from '@fakturky/ui/components/relative-date'
import { cn } from '@fakturky/ui/lib/utils'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { MoreHorizontal, Pause, Play, Repeat, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { cs } from '@/i18n/cs'
import { orpc } from '@/lib/orpc'
import { RepeatForm } from './repeat-form'

type Template = RouterOutputs['templates']['list'][number]
type Rule = RouterOutputs['recurring']['list'][number]

const t = cs.templates

function useTemplateActions(onRuleCreated: () => void) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
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
      onSuccess: async (rule) => {
        toast.success(t.ruleCreatedOn(formatDateCs(rule.nextRunOn)))
        onRuleCreated()
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
  return { use, del, create, update, delRule }
}

function Schedule({ rule }: { rule: Rule | undefined }) {
  if (!rule) return <span className="text-muted-foreground">{t.noRepeat}</span>
  return (
    <span className={cn(!rule.active && 'text-muted-foreground')}>
      {t.frequency[rule.frequency]}
      {' · '}
      {rule.active ? (
        <>
          {t.nextShort} <RelativeDate date={rule.nextRunOn} />
        </>
      ) : (
        t.paused
      )}
      {rule.autoIssue && (
        <span className="text-muted-foreground">
          {' · '}
          {rule.autoSend ? t.autoSendShort : t.autoIssueShort}
        </span>
      )}
    </span>
  )
}

/**
 * Flat template rows: name and net total, the schedule with its next run, one-tap "Použít".
 * `openRepeatFor` opens that template's repeat form on arrival (from the "Nastavit opakování" toast).
 */
export function TemplateList({
  templates,
  rules,
  openRepeatFor,
}: {
  templates: Template[]
  rules: Rule[]
  openRepeatFor: string | undefined
}) {
  const [repeatFor, setRepeatFor] = useState<string | null>(openRepeatFor ?? null)
  const { use, del, create, update, delRule } = useTemplateActions(() => setRepeatFor(null))
  const ruleByTemplate = new Map(rules.map((r) => [r.templateId, r]))

  // Bring the template the toast pointed at into view once it is rendered.
  useEffect(() => {
    if (!openRepeatFor || !templates.some((x) => x.id === openRepeatFor)) return
    setRepeatFor(openRepeatFor)
    document.getElementById(`tpl-${openRepeatFor}`)?.scrollIntoView({ block: 'center' })
  }, [openRepeatFor, templates])

  return (
    <ul className="border-t">
      {templates.map((tpl) => {
        const rule = ruleByTemplate.get(tpl.id)
        const currency = tpl.body.currency ?? 'CZK'
        const net = toFixed(
          sum(tpl.body.lines.map((l) => parseDecimal(l.quantity).times(l.unitPrice))),
        )
        const showForm = repeatFor === tpl.id
        const toggleRepeat = () => setRepeatFor(showForm ? null : tpl.id)
        const togglePause = () => rule && update.mutate({ id: rule.id, active: !rule.active })
        return (
          <li
            id={`tpl-${tpl.id}`}
            key={tpl.id}
            className="row-hover border-b py-3 sm:-mx-3 sm:px-3 sm:py-3.5"
          >
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,19rem)_15rem]">
              <div className="min-w-0">
                <h2 className="truncate text-[15px] font-medium">{tpl.name}</h2>
                <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-[13px] text-muted-foreground">
                  <span>{t.lines(tpl.body.lines.length)}</span>
                  <span aria-hidden>·</span>
                  <span>
                    <Amount value={net} currency={currency} size="sm" hideZeroFraction /> {t.net}
                  </span>
                </p>
              </div>

              <div className="col-start-1 row-start-2 min-w-0 text-[13px] sm:col-start-2 sm:row-start-1 sm:text-sm">
                <Schedule rule={rule} />
              </div>

              <div className="col-start-2 row-span-2 row-start-1 flex items-center gap-1 sm:col-start-3 sm:row-span-1 sm:justify-end">
                <Button
                  variant="outline"
                  disabled={use.isPending}
                  onClick={() => use.mutate({ id: tpl.id })}
                >
                  {t.use}
                </Button>
                {rule ? (
                  <Button
                    variant="ghost"
                    className="text-muted-foreground max-sm:hidden"
                    onClick={togglePause}
                  >
                    {rule.active ? <Pause aria-hidden /> : <Play aria-hidden />}
                    {rule.active ? t.pause : t.resume}
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    className="text-muted-foreground max-sm:hidden"
                    aria-expanded={showForm}
                    onClick={toggleRepeat}
                  >
                    {t.repeat}
                  </Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`${t.menu}: ${tpl.name}`}
                        className="text-muted-foreground"
                      />
                    }
                  >
                    <MoreHorizontal aria-hidden />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="bottom" align="end" className="min-w-52">
                    {rule ? (
                      <DropdownMenuItem className="sm:hidden" onClick={togglePause}>
                        {rule.active ? <Pause aria-hidden /> : <Play aria-hidden />}
                        {rule.active ? t.pause : t.resume}
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem className="sm:hidden" onClick={toggleRepeat}>
                        <Repeat aria-hidden /> {t.repeat}
                      </DropdownMenuItem>
                    )}
                    {rule && (
                      <DropdownMenuItem onClick={() => delRule.mutate({ id: rule.id })}>
                        <X aria-hidden /> {t.cancelRule}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator className={cn(!rule && 'sm:hidden')} />
                    <DropdownMenuItem onClick={() => del.mutate({ id: tpl.id })}>
                      <Trash2 aria-hidden /> {t.deleteTemplate}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {showForm && !rule && (
              <div className="pt-4 pb-1">
                <RepeatForm
                  templateId={tpl.id}
                  pending={create.isPending}
                  onCancel={() => setRepeatFor(null)}
                  onSubmit={(v) => create.mutate({ templateId: tpl.id, ...v })}
                />
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
