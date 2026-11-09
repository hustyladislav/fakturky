import type { RouterOutputs } from '@fakturky/core/router'
import { parseDecimal, sum, toFixed } from '@fakturky/domain'
import { formatDateCs } from '@fakturky/domain/dates'
import { Amount } from '@fakturky/ui/components/amount'
import { Button } from '@fakturky/ui/components/button'
import { RelativeDate } from '@fakturky/ui/components/relative-date'
import { cn } from '@fakturky/ui/lib/utils'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Pause, Play, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { cs } from '@/i18n/cs'
import { refreshDocumentData } from '@/lib/document-cache'
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

  const use = useMutation(
    orpc.templates.use.mutationOptions({
      onSuccess: async (d) => {
        toast.success(t.used)
        await refreshDocumentData(queryClient)
        navigate({ to: '/faktury/$id/upravit', params: { id: d.id } })
      },
    }),
  )
  const del = useMutation(
    orpc.templates.delete.mutationOptions({
      onSuccess: async () => {
        toast.success(t.deleted)
        await refresh()
      },
    }),
  )
  const create = useMutation(
    orpc.recurring.create.mutationOptions({
      onSuccess: async (rule) => {
        toast.success(t.ruleCreatedOn(formatDateCs(rule.nextRunOn)))
        onRuleCreated()
        await refresh()
      },
    }),
  )
  const update = useMutation(orpc.recurring.update.mutationOptions({ onSuccess: refresh }))
  const delRule = useMutation(
    orpc.recurring.delete.mutationOptions({
      onSuccess: async () => {
        toast.success(t.ruleDeleted)
        await refresh()
      },
    }),
  )
  return { use, del, create, update, delRule }
}

function Schedule({ rule }: { rule: Rule }) {
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
 * Flat template rows: name and net total, one-tap "Použít", and every recurring rule of the template
 * with its own pause/resume and cancel. `openRepeatFor` opens that template's repeat form once on
 * arrival (from the "Nastavit opakování" toast).
 * `rules === undefined` means they failed to load: templates still render, without schedules.
 */
export function TemplateList({
  templates,
  rules,
  openRepeatFor,
}: {
  templates: Template[]
  rules: Rule[] | undefined
  openRepeatFor: string | undefined
}) {
  const [repeatFor, setRepeatFor] = useState<string | null>(openRepeatFor ?? null)
  const { use, del, create, update, delRule } = useTemplateActions(() => setRepeatFor(null))
  const arrived = useRef(false)

  useEffect(() => {
    if (arrived.current || !openRepeatFor || !templates.some((x) => x.id === openRepeatFor)) return
    arrived.current = true
    setRepeatFor(openRepeatFor)
    document.getElementById(`tpl-${openRepeatFor}`)?.scrollIntoView({ block: 'center' })
  }, [openRepeatFor, templates])

  return (
    <ul className="border-t">
      {templates.map((tpl) => {
        const own = (rules ?? []).filter((r) => r.templateId === tpl.id)
        const currency = tpl.body.currency ?? 'CZK'
        const net = toFixed(
          sum(tpl.body.lines.map((l) => parseDecimal(l.quantity).times(l.unitPrice))),
        )
        const showForm = repeatFor === tpl.id
        return (
          <li
            id={`tpl-${tpl.id}`}
            key={tpl.id}
            className="row-hover border-b py-3 sm:-mx-3 sm:px-3 sm:py-3.5"
          >
            <div className="flex items-center justify-between gap-x-4">
              <div className="min-w-0">
                <h2 className="truncate text-[15px] font-medium">{tpl.name}</h2>
                <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-[13px] text-muted-foreground">
                  <span>{t.lines(tpl.body.lines.length)}</span>
                  <span aria-hidden>·</span>
                  <span>
                    <Amount value={net} currency={currency} size="sm" hideZeroFraction /> {t.net}
                  </span>
                  {rules && own.length === 0 && (
                    <>
                      <span aria-hidden>·</span>
                      <span>{t.noRepeat}</span>
                    </>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="outline"
                  disabled={use.isPending}
                  onClick={() => use.mutate({ id: tpl.id })}
                >
                  {t.use}
                </Button>
                {rules && (
                  <Button
                    variant="ghost"
                    className="text-muted-foreground"
                    aria-expanded={showForm}
                    onClick={() => setRepeatFor(showForm ? null : tpl.id)}
                  >
                    {t.repeat}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground"
                  aria-label={`${t.deleteTemplate}: ${tpl.name}`}
                  onClick={() => del.mutate({ id: tpl.id })}
                >
                  <Trash2 aria-hidden />
                </Button>
              </div>
            </div>

            {own.length > 0 && (
              <ul className="mt-1">
                {own.map((r) => (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-x-4 text-[13px] sm:text-sm"
                  >
                    <Schedule rule={r} />
                    <span className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        className="text-muted-foreground"
                        disabled={update.isPending}
                        onClick={() => update.mutate({ id: r.id, active: !r.active })}
                      >
                        {r.active ? <Pause aria-hidden /> : <Play aria-hidden />}
                        {r.active ? t.pause : t.resume}
                      </Button>
                      <Button
                        variant="ghost"
                        className="text-muted-foreground"
                        disabled={delRule.isPending}
                        onClick={() => delRule.mutate({ id: r.id })}
                      >
                        <X aria-hidden /> {t.cancelRule}
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {showForm && (
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
