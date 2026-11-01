import { BRAND } from '@fakturky/core/brand'
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
import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Divider, GoogleButton, MagicLinkButton } from '@/components/social-sign-in'
import { cs } from '@/i18n/cs'
import { authClient } from '@/lib/auth-client'

export function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const signUp = mode === 'sign-up'

  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{signUp ? cs.auth.signUpTitle : cs.auth.signInTitle}</CardTitle>
          <CardDescription>
            {signUp ? cs.auth.signUpDescription : cs.auth.signInDescription}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <GoogleButton />
          <Divider />
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault()
              setError(null)
              setPending(true)
              const form = new FormData(e.currentTarget)
              const email = String(form.get('email'))
              const password = String(form.get('password'))
              const result = signUp
                ? await authClient.signUp.email({ name: String(form.get('name')), email, password })
                : await authClient.signIn.email({ email, password })
              setPending(false)
              if (result.error) {
                setError(signUp ? cs.auth.signUpFailed : cs.auth.invalidCredentials)
                return
              }
              queryClient.clear()
              await navigate({ to: '/' })
            }}
          >
            {signUp && (
              <div className="space-y-2">
                <Label htmlFor="name">{cs.auth.name}</Label>
                <Input id="name" name="name" autoComplete="name" required />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">{cs.auth.email}</Label>
              <Input id="email" name="email" type="email" autoComplete="email webauthn" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{cs.auth.password}</Label>
              <Input
                id="password"
                name="password"
                type="password"
                minLength={8}
                autoComplete={signUp ? 'new-password' : 'current-password webauthn'}
                required
              />
              {signUp && <p className="text-xs text-muted-foreground">{cs.auth.passwordHint}</p>}
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={pending}>
              {signUp ? cs.auth.signUpAction : cs.auth.signInAction}
            </Button>
          </form>
          <MagicLinkButton
            getEmail={() =>
              (document.getElementById('email') as HTMLInputElement | null)?.value ?? ''
            }
          />
          {!signUp && (
            <Button
              variant="outline"
              className="w-full"
              onClick={async () => {
                const result = await authClient.signIn.passkey()
                if (result?.error) setError(cs.auth.invalidCredentials)
                else {
                  queryClient.clear()
                  await navigate({ to: '/' })
                }
              }}
            >
              {cs.auth.passkeyAction}
            </Button>
          )}
          <p className="text-center text-sm text-muted-foreground">
            {signUp ? cs.auth.haveAccount : cs.auth.noAccount}{' '}
            <Link to={signUp ? '/prihlaseni' : '/registrace'} className="underline">
              {signUp ? cs.auth.signInAction : cs.auth.signUpAction}
            </Link>
          </p>
          <p className="text-center text-xs text-muted-foreground">{BRAND.name}</p>
        </CardContent>
      </Card>
    </main>
  )
}
