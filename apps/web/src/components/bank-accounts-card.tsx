import { Badge } from '@fakturky/ui/components/badge'
import { Button } from '@fakturky/ui/components/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@fakturky/ui/components/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@fakturky/ui/components/dialog'
import { Input } from '@fakturky/ui/components/input'
import { Label } from '@fakturky/ui/components/label'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { cs } from '@/i18n/cs'
import { orpc } from '@/lib/orpc'

const t = cs.bankAccounts

export function BankAccountsCard() {
  const queryClient = useQueryClient()
  const list = useQuery(orpc.bankAccounts.list.queryOptions({ input: {} }))
  const refresh = () => queryClient.invalidateQueries({ queryKey: orpc.bankAccounts.key() })
  const setDefault = useMutation(
    orpc.bankAccounts.setDefault.mutationOptions({
      onSuccess: async () => {
        toast.success(t.updated)
        await refresh()
      },
    }),
  )
  const remove = useMutation(
    orpc.bankAccounts.delete.mutationOptions({
      onSuccess: async () => {
        toast.success(t.deleted)
        await refresh()
      },
    }),
  )

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1.5">
          <CardTitle>{t.title}</CardTitle>
          <CardDescription>{t.description}</CardDescription>
        </div>
        <NewBankAccount onCreated={refresh} />
      </CardHeader>
      <CardContent className="space-y-3">
        {list.data?.length === 0 && <p className="text-muted-foreground text-sm">{t.empty}</p>}
        {list.data?.map((a) => (
          <div
            key={a.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
          >
            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-2 font-medium">
                {a.label}
                <span className="text-muted-foreground text-xs">{a.currency}</span>
                {a.defaultForCurrency && <Badge variant="secondary">{t.default}</Badge>}
              </div>
              <div className="text-muted-foreground text-sm tabular-nums">
                {a.accountNumber ? `${a.accountNumber}/${a.bankCode} · ` : ''}
                {a.iban}
                {a.bic ? ` · ${a.bic}` : ''}
              </div>
            </div>
            <div className="flex gap-2">
              {!a.defaultForCurrency && (
                <Button variant="outline" size="sm" onClick={() => setDefault.mutate({ id: a.id })}>
                  {t.makeDefault}
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => remove.mutate({ id: a.id })}>
                {t.delete}
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function NewBankAccount({ onCreated }: { onCreated: () => unknown }) {
  const [open, setOpen] = useState(false)
  const create = useMutation(
    orpc.bankAccounts.create.mutationOptions({
      onSuccess: async () => {
        toast.success(t.created)
        setOpen(false)
        await onCreated()
      },
      onError: (e) =>
        toast.error((e as { code?: string }).code === 'BAD_REQUEST' ? t.invalid : cs.common.error),
    }),
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>{t.new}</DialogTrigger>
      <DialogContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            const f = new FormData(e.currentTarget)
            const text = (k: string) => String(f.get(k) ?? '').trim()
            create.mutate({
              label: text('label'),
              account: text('account'),
              currency: text('currency') || 'CZK',
              bic: text('bic') || undefined,
              showQr: f.get('showQr') === 'on',
            })
          }}
        >
          <DialogHeader>
            <DialogTitle>{t.new}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="ba-label">{t.label}</Label>
            <Input id="ba-label" name="label" placeholder={t.labelPlaceholder} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ba-account">{t.account}</Label>
            <Input id="ba-account" name="account" placeholder={t.accountPlaceholder} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ba-currency">{t.currency}</Label>
              <Input id="ba-currency" name="currency" defaultValue="CZK" maxLength={3} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ba-bic">
                {t.bic} <span className="text-muted-foreground">({t.bicOptional})</span>
              </Label>
              <Input id="ba-bic" name="bic" maxLength={11} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="showQr" defaultChecked />
            {t.showQr}
          </label>
          <DialogFooter>
            <Button type="submit" disabled={create.isPending}>
              {cs.common.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
