import { Button } from '@fakturky/ui/components/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@fakturky/ui/components/card'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { cs } from '@/i18n/cs'
import { authClient } from '@/lib/auth-client'

export const Route = createFileRoute('/souhlas')({
  validateSearch: (search: Record<string, unknown>) => ({
    client_id: typeof search.client_id === 'string' ? search.client_id : undefined,
  }),
  component: Consent,
})

function Consent() {
  const { client_id: clientId } = Route.useSearch()
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)

  const client = useQuery({
    queryKey: ['oauth-client', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const res = await authClient.oauth2.publicClient({ query: { client_id: clientId ?? '' } })
      return res.data
    },
  })

  const decide = async (accept: boolean) => {
    setPending(true)
    setFailed(false)
    const res = await authClient.oauth2.consent({ accept })
    const url = (res.data as { url?: string } | null)?.url
    if (res.error || !url) {
      setFailed(true)
      setPending(false)
      return
    }
    window.location.href = url
  }

  if (!clientId) {
    return (
      <div className="mx-auto max-w-md p-6">
        <p>{cs.consent.invalid}</p>
      </div>
    )
  }

  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{cs.consent.title}</CardTitle>
          <CardDescription>
            {cs.consent.description(client.data?.client_name ?? cs.consent.unknownClient)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1 text-sm">
            <p className="font-medium">{cs.consent.scopeTitle}</p>
            <ul className="list-disc pl-5 text-muted-foreground">
              <li>{cs.consent.scopeTools}</li>
            </ul>
          </div>
          {failed && <p className="text-sm text-destructive">{cs.common.error}</p>}
          <div className="flex gap-2">
            <Button disabled={pending} onClick={() => decide(true)}>
              {cs.consent.allow}
            </Button>
            <Button variant="outline" disabled={pending} onClick={() => decide(false)}>
              {cs.consent.deny}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{cs.consent.footer}</p>
        </CardContent>
      </Card>
    </main>
  )
}
