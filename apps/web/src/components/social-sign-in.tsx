import { Button } from '@fakturky/ui/components/button'
import { useState } from 'react'
import { cs } from '@/i18n/cs'
import { authClient } from '@/lib/auth-client'

export function GoogleButton() {
  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      onClick={() =>
        authClient.signIn.social({ provider: 'google', callbackURL: '/', newUserCallbackURL: '/' })
      }
    >
      {cs.auth.google}
    </Button>
  )
}

export function Divider() {
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <span className="h-px flex-1 bg-border" />
      {cs.auth.orDivider}
      <span className="h-px flex-1 bg-border" />
    </div>
  )
}

/** Sends a magic link to the e-mail currently typed in the form (read from the DOM input). */
export function MagicLinkButton({ getEmail }: { getEmail: () => string }) {
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)
  const [pending, setPending] = useState(false)

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="ghost"
        className="w-full"
        disabled={pending}
        onClick={async () => {
          const email = getEmail().trim()
          if (!email) return setMessage({ text: cs.auth.magicLinkNeedsEmail, error: true })
          setPending(true)
          const result = await authClient.signIn.magicLink({ email, callbackURL: '/' })
          setPending(false)
          if (!result.error) return setMessage({ text: cs.auth.magicLinkSent, error: false })
          const unavailable =
            result.error.status === 503 || result.error.message?.includes('EMAIL_NOT_CONFIGURED')
          setMessage({
            text: unavailable ? cs.auth.magicLinkUnavailable : cs.auth.magicLinkFailed,
            error: true,
          })
        }}
      >
        {cs.auth.magicLinkAction}
      </Button>
      {message && (
        <p role="status" className={`text-sm ${message.error ? 'text-destructive' : ''}`}>
          {message.text}
        </p>
      )}
    </div>
  )
}
