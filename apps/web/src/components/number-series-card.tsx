import { Button } from '@fakturky/ui/components/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@fakturky/ui/components/card'
import { Input } from '@fakturky/ui/components/input'
import { Label } from '@fakturky/ui/components/label'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { cs } from '@/i18n/cs'
import { orpc } from '@/lib/orpc'

const t = cs.numberSeries

type Series = {
  id: string
  documentType: string
  name: string
  pattern: string
  nextValue: number
  nextNumber: string
}

function Row({ s }: { s: Series }) {
  const queryClient = useQueryClient()
  const [pattern, setPattern] = useState(s.pattern)
  const [next, setNext] = useState('')
  const refresh = () => queryClient.invalidateQueries({ queryKey: orpc.numberSeries.key() })
  const onError = (e: unknown) => toast.error((e as Error).message || cs.common.error)
  const update = useMutation(
    orpc.numberSeries.update.mutationOptions({
      onSuccess: async () => {
        toast.success(t.saved)
        await refresh()
      },
      onError,
    }),
  )
  const setNextValue = useMutation(
    orpc.numberSeries.setNext.mutationOptions({
      onSuccess: async () => {
        toast.success(t.saved)
        setNext('')
        await refresh()
      },
      onError,
    }),
  )
  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="font-medium">
          {t.types[s.documentType as keyof typeof t.types] ?? s.name}
        </div>
        <div className="text-muted-foreground text-sm">
          {t.nextNumber}:{' '}
          <span className="text-foreground font-medium tabular-nums">{s.nextNumber}</span>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`p-${s.id}`}>{t.pattern}</Label>
          <div className="flex gap-2">
            <Input id={`p-${s.id}`} value={pattern} onChange={(e) => setPattern(e.target.value)} />
            <Button
              variant="outline"
              disabled={pattern === s.pattern || update.isPending}
              onClick={() => update.mutate({ id: s.id, pattern })}
            >
              {cs.common.save}
            </Button>
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`n-${s.id}`}>{t.continueFrom}</Label>
          <div className="flex gap-2">
            <Input
              id={`n-${s.id}`}
              inputMode="numeric"
              placeholder={String(s.nextValue)}
              value={next}
              onChange={(e) => setNext(e.target.value.replace(/\D/g, ''))}
            />
            <Button
              variant="outline"
              disabled={!next || setNextValue.isPending}
              onClick={() => setNextValue.mutate({ id: s.id, value: Number(next) })}
            >
              {t.set}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function NumberSeriesCard() {
  const list = useQuery(orpc.numberSeries.list.queryOptions({ input: {} }))
  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          {t.title}
        </CardTitle>
        <CardDescription>{t.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {list.data?.map((s) => (
          <Row key={`${s.id}:${s.pattern}:${s.nextValue}`} s={s} />
        ))}
      </CardContent>
    </Card>
  )
}
