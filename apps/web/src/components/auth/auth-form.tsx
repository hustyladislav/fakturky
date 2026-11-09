import { Button } from '@fakturky/ui/components/button'
import { Input } from '@fakturky/ui/components/input'
import { Label } from '@fakturky/ui/components/label'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { AuthLayout } from '@/components/auth/auth-layout'
import { Divider, GoogleButton, MagicLinkButton } from '@/components/auth/social-sign-in'
import { cs } from '@/i18n/cs'
import { authClient } from '@/lib/auth-client'

export function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  // Before hydration the browser would submit the form natively (GET), putting the
  // password into the URL. Keep the button disabled until the JS handler is attached.
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])
  const signUp = mode === 'sign-up'

  return (
    <AuthLayout>
      <div className="space-y-6">
        <div className="space-y-1.5">
          <h1 className="text-[28px] leading-8 font-normal tracking-[-0.02em]">
            {signUp ? cs.auth.signUpTitle : cs.auth.signInTitle}
          </h1>
          <p className="text-sm text-muted-foreground">
            {signUp ? cs.auth.signUpDescription : cs.auth.signInDescription}
          </p>
        </div>
        <div className="space-y-4">
          <form
            method="post"
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
              // Signing in as part of an OAuth (MCP) authorization: continue to the consent step.
              const next = (result.data as { redirect?: boolean; url?: string } | null)?.url
              if ((result.data as { redirect?: boolean } | null)?.redirect && next) {
                window.location.href = next
                return
              }
              await navigate({ to: '/' })
            }}
          >
            {signUp && (
              <div className="space-y-2">
                <Label htmlFor="name">{cs.auth.name}</Label>
                <Input id="name" name="name" autoComplete="name" required className="h-11" />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">{cs.auth.email}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email webauthn"
                required
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{cs.auth.password}</Label>
              <Input
                id="password"
                name="password"
                type="password"
                minLength={8}
                className="h-11"
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
            <Button
              type="submit"
              variant="brand"
              size="lg"
              className="h-11 w-full"
              disabled={pending || !hydrated}
            >
              {signUp ? cs.auth.signUpAction : cs.auth.signInAction}
            </Button>
          </form>
          <Divider />
          <GoogleButton />
          <MagicLinkButton
            getEmail={() =>
              (document.getElementById('email') as HTMLInputElement | null)?.value ?? ''
            }
          />
          {!signUp && (
            <Button
              variant="outline"
              className="h-11 w-full"
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
            <Link
              to={signUp ? '/prihlaseni' : '/registrace'}
              className="text-foreground underline underline-offset-4"
            >
              {signUp ? cs.auth.signInAction : cs.auth.signUpAction}
            </Link>
          </p>
        </div>
      </div>
    </AuthLayout>
  )
}
