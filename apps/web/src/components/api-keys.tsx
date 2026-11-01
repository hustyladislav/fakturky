import { Button } from '@fakturky/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@fakturky/ui/components/dialog'
import { Input } from '@fakturky/ui/components/input'
import { Label } from '@fakturky/ui/components/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@fakturky/ui/components/table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { cs } from '@/i18n/cs'
import { authClient } from '@/lib/auth-client'

const queryKey = ['api-keys']

const formatDate = (value: Date | string | null | undefined) =>
  value ? new Date(value).toLocaleDateString('cs-CZ') : cs.apiKeys.never

export function ApiKeys() {
  const queryClient = useQueryClient()
  // Mirrors the server: the session's active organization may be unset right after sign-up.
  const { data: organizations } = authClient.useListOrganizations()
  const organizationId = organizations?.[0]?.id

  const list = useQuery({
    queryKey,
    enabled: !!organizationId,
    queryFn: async () => {
      const res = await authClient.apiKey.list({ query: { organizationId } })
      if (res.error) throw new Error(res.error.message)
      return res.data.apiKeys
    },
  })

  const revoke = useMutation({
    mutationFn: async (keyId: string) => {
      const res = await authClient.apiKey.delete({ keyId })
      if (res.error) throw new Error(res.error.message)
    },
    onSuccess: async () => {
      toast.success(cs.apiKeys.revoked)
      await queryClient.invalidateQueries({ queryKey })
    },
    onError: () => toast.error(cs.common.error),
  })

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">{cs.apiKeys.title}</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">{cs.apiKeys.description}</p>
          <p className="text-sm">
            <a className="underline" href="/docs/api">
              {cs.apiKeys.docsLink}
            </a>
          </p>
        </div>
        {organizationId && <NewKey organizationId={organizationId} />}
      </div>
      {list.data?.length === 0 ? (
        <p className="text-muted-foreground">{cs.apiKeys.empty}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{cs.apiKeys.name}</TableHead>
              <TableHead>{cs.apiKeys.prefix}</TableHead>
              <TableHead>{cs.apiKeys.created}</TableHead>
              <TableHead>{cs.apiKeys.lastUsed}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.data?.map((k) => (
              <TableRow key={k.id}>
                <TableCell className="font-medium">{k.name}</TableCell>
                <TableCell className="font-mono text-sm">{k.start}…</TableCell>
                <TableCell>{formatDate(k.createdAt)}</TableCell>
                <TableCell>{formatDate(k.lastRequest)}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (window.confirm(cs.apiKeys.revokeConfirm)) revoke.mutate(k.id)
                    }}
                  >
                    {cs.apiKeys.revoke}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  )
}

function NewKey({ organizationId }: { organizationId: string }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [secret, setSecret] = useState<string | null>(null)

  const create = useMutation({
    mutationFn: async (name: string) => {
      const res = await authClient.apiKey.create({ name, organizationId })
      if (res.error) throw new Error(res.error.message)
      return res.data.key
    },
    onSuccess: async (key) => {
      setSecret(key)
      await queryClient.invalidateQueries({ queryKey })
    },
    onError: () => toast.error(cs.common.error),
  })

  const close = (next: boolean) => {
    setOpen(next)
    if (!next) setSecret(null)
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogTrigger render={<Button />}>{cs.apiKeys.new}</DialogTrigger>
      <DialogContent>
        {secret ? (
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle>{cs.apiKeys.shownTitle}</DialogTitle>
              <DialogDescription>{cs.apiKeys.shownWarning}</DialogDescription>
            </DialogHeader>
            <Input
              readOnly
              value={secret}
              className="font-mono"
              onFocus={(e) => e.target.select()}
            />
            <DialogFooter>
              <Button
                variant="outline"
                onClick={async () => {
                  await navigator.clipboard.writeText(secret)
                  toast.success(cs.apiKeys.copied)
                }}
              >
                {cs.apiKeys.copy}
              </Button>
              <Button onClick={() => close(false)}>{cs.apiKeys.done}</Button>
            </DialogFooter>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              const name = String(new FormData(e.currentTarget).get('name') ?? '').trim()
              if (name) create.mutate(name)
            }}
          >
            <DialogHeader>
              <DialogTitle>{cs.apiKeys.new}</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="key-name">{cs.apiKeys.name}</Label>
              <Input
                id="key-name"
                name="name"
                required
                maxLength={64}
                placeholder={cs.apiKeys.namePlaceholder}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={create.isPending}>
                {cs.apiKeys.createAction}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
