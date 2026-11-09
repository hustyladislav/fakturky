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
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { cs } from '@/i18n/cs'
import { authClient } from '@/lib/auth-client'
import { pageHead } from '@/lib/head'
import { getSessionFn } from '@/server/session'

const t = cs.device

export const Route = createFileRoute('/pripojit')({
  head: pageHead(t.pageTitle),
  validateSearch: (search: Record<string, unknown>) => ({
    user_code: typeof search.user_code === 'string' ? search.user_code : undefined,
  }),
  beforeLoad: async ({ search }) => {
    if (!(await getSessionFn())) {
      throw redirect({
        to: '/prihlaseni',
        search: search.user_code ? ({ pripojit: search.user_code } as never) : undefined,
      })
    }
  },
  component: Connect,
})

function Shell({
  title,
  text,
  children,
}: {
  title: string
  text: string
  children?: React.ReactNode
}) {
  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{text}</CardDescription>
        </CardHeader>
        {children && <CardContent className="space-y-4">{children}</CardContent>}
      </Card>
    </main>
  )
}

function EnterCode() {
  const navigate = useNavigate()
  return (
    <Shell title={t.title} text={t.description}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          const code = String(new FormData(e.currentTarget).get('code')).trim()
          if (code) void navigate({ to: '/pripojit', search: { user_code: code } })
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="device-code">{t.codeLabel}</Label>
          <Input id="device-code" name="code" autoComplete="off" required />
        </div>
        <Button type="submit">{t.continue}</Button>
      </form>
    </Shell>
  )
}

function Review({ code }: { code: string }) {
  const [pending, setPending] = useState(false)
  const [outcome, setOutcome] = useState<'allowed' | 'denied' | 'failed' | null>(null)
  // Opening the page claims the request for the signed-in user; only they can then decide it.
  const request = useQuery({
    queryKey: ['device-request', code],
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
    queryFn: async () => {
      const res = await authClient.device({ query: { user_code: code } })
      if (res.error || res.data?.status !== 'pending') throw new Error('invalid')
      return res.data
    },
  })

  const decide = async (allow: boolean) => {
    setPending(true)
    const res = allow
      ? await authClient.device.approve({ userCode: code })
      : await authClient.device.deny({ userCode: code })
    setPending(false)
    setOutcome(res.error ? 'failed' : allow ? 'allowed' : 'denied')
  }

  if (outcome === 'allowed') return <Shell title={t.allowed} text={t.allowedText} />
  if (outcome === 'denied') return <Shell title={t.denied} text={t.deniedText} />
  if (request.isError || outcome === 'failed') return <Shell title={t.title} text={t.invalid} />

  return (
    <Shell title={t.title} text={t.description}>
      <div>
        <p className="text-[13px] text-muted-foreground">{t.codeLabel}</p>
        <p className="font-mono text-xl tracking-widest" data-testid="device-code">
          {code}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{t.codeCheck}</p>
      </div>
      <div className="space-y-1 text-sm">
        <p className="font-medium">{t.scopeTitle}</p>
        <ul className="list-disc pl-5 text-muted-foreground">
          <li>{t.scopeTools}</li>
        </ul>
      </div>
      <p className="text-sm">{t.warning}</p>
      <div className="flex gap-2">
        <Button disabled={pending || !request.isSuccess} onClick={() => decide(true)}>
          {t.allow}
        </Button>
        <Button
          variant="outline"
          disabled={pending || !request.isSuccess}
          onClick={() => decide(false)}
        >
          {t.deny}
        </Button>
      </div>
    </Shell>
  )
}

function Connect() {
  const { user_code: code } = Route.useSearch()
  return code ? <Review code={code} /> : <EnterCode />
}
