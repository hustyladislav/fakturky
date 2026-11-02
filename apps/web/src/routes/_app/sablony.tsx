import { formatDateCs } from '@fakturky/domain/dates'
import { Badge } from '@fakturky/ui/components/badge'
import { Button } from '@fakturky/ui/components/button'
import { EmptyState } from '@fakturky/ui/components/empty-state'
import { Input } from '@fakturky/ui/components/input'
import { Label } from '@fakturky/ui/components/label'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { FileStack } from 'lucide-react'
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

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">{t.title}</h1>

      {templates.data?.length === 0 && (
        <EmptyState icon={FileStack} title={t.emptyTitle}>
          {t.empty}
        </EmptyState>
      )}
      <div className="space-y-2">
        {templates.data?.map((tpl) => (
          <div key={tpl.id} className="space-y-3 rounded-xl border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-medium">{tpl.name}</div>
                <div className="text-muted-foreground text-sm">
                  {t.lines(tpl.body.lines.length)}
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => use.mutate({ id: tpl.id })}>
                  {t.use}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setRepeatFor(tpl.id)}>
                  {t.repeat}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => del.mutate({ id: tpl.id })}>
                  {t.delete}
                </Button>
              </div>
            </div>
            {repeatFor === tpl.id && (
              <form
                className="grid gap-3 border-t pt-3 sm:grid-cols-3"
                onSubmit={(e) => {
                  e.preventDefault()
                  const f = new FormData(e.currentTarget)
                  create.mutate({
                    templateId: tpl.id,
                    frequency: f.get('frequency') as 'monthly' | 'quarterly' | 'yearly',
                    dayOfMonth: Number(f.get('day')),
                    startOn: String(f.get('startOn') || '') || undefined,
                    autoIssue: f.get('autoIssue') === 'on',
                    autoSend: f.get('autoSend') === 'on',
                  })
                }}
              >
                <div className="space-y-1">
                  <Label htmlFor={`fr-${tpl.id}`}>{t.repeat}</Label>
                  <select
                    id={`fr-${tpl.id}`}
                    name="frequency"
                    className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                  >
                    {Object.entries(t.frequency).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`d-${tpl.id}`}>{t.day}</Label>
                  <Input
                    id={`d-${tpl.id}`}
                    name="day"
                    type="number"
                    min={1}
                    max={31}
                    defaultValue={1}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`s-${tpl.id}`}>{t.startOn}</Label>
                  <Input id={`s-${tpl.id}`} name="startOn" type="date" />
                </div>
                <label className="flex items-center gap-2 text-sm sm:col-span-3">
                  <input type="checkbox" name="autoIssue" /> {t.autoIssue}
                </label>
                <label className="flex items-center gap-2 text-sm sm:col-span-3">
                  <input type="checkbox" name="autoSend" /> {t.autoSend}
                </label>
                <div className="flex gap-2 sm:col-span-3">
                  <Button type="submit" disabled={create.isPending}>
                    {t.createRule}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setRepeatFor(null)}>
                    {cs.common.cancel}
                  </Button>
                </div>
              </form>
            )}
          </div>
        ))}
      </div>

      <section className="space-y-2">
        <h2 className="font-semibold">{t.recurringTitle}</h2>
        {rules.data?.length === 0 && (
          <p className="text-muted-foreground text-sm">{t.recurringEmpty}</p>
        )}
        {rules.data?.map((r) => (
          <div
            key={r.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-sm"
          >
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 font-medium">
                {r.templateName}
                <Badge variant="secondary">{t.frequency[r.frequency]}</Badge>
                {!r.active && <Badge variant="outline">{t.paused}</Badge>}
              </div>
              <div className="text-muted-foreground">
                {t.nextRun}: {formatDateCs(r.nextRunOn)}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => update.mutate({ id: r.id, active: !r.active })}
              >
                {r.active ? t.pause : t.resume}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => delRule.mutate({ id: r.id })}>
                {t.delete}
              </Button>
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}
