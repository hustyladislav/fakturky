import { Button } from '@fakturky/ui/components/button'
import { useState } from 'react'
import { cs } from '@/i18n/cs'
import { authClient } from '@/lib/auth-client'

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.5 12.27c0-.79-.07-1.54-.2-2.27H12v4.29h5.9a5.05 5.05 0 0 1-2.19 3.31v2.75h3.54c2.07-1.91 3.25-4.72 3.25-8.08Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.54-2.75c-.98.66-2.24 1.05-3.74 1.05-2.87 0-5.3-1.94-6.17-4.55H2.17v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.83 14.09a6.6 6.6 0 0 1 0-4.18V7.07H2.17a11 11 0 0 0 0 9.86l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.36c1.62 0 3.07.56 4.21 1.65l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.17 7.07l3.66 2.84C6.7 7.3 9.13 5.36 12 5.36Z"
      />
    </svg>
  )
}

export function GoogleButton() {
  return (
    <Button
      type="button"
      variant="outline"
      className="h-11 w-full"
      onClick={() =>
        authClient.signIn.social({ provider: 'google', callbackURL: '/', newUserCallbackURL: '/' })
      }
    >
      <GoogleMark />
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
        className="h-11 w-full text-muted-foreground"
        disabled={pending}
        onClick={async () => {
          const email = getEmail().trim()
          if (!email) return setMessage({ text: cs.auth.magicLinkNeedsEmail, error: true })
          setPending(true)
          const result = await authClient.signIn.magicLink({ email, callbackURL: '/' })
          setPending(false)
          if (!result.error) return setMessage({ text: cs.auth.magicLinkSent, error: false })
          const code = result.error.message ?? ''
          setMessage({
            text: code.includes('EMAIL_RESTRICTED')
              ? cs.auth.magicLinkRestricted
              : code.includes('EMAIL_NOT_CONFIGURED')
                ? cs.auth.magicLinkUnavailable
                : cs.auth.magicLinkFailed,
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
