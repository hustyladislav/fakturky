import { Button } from '@fakturky/ui/components/button'
import { Share, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cs } from '@/i18n/cs'

type InstallPromptEvent = Event & { prompt: () => Promise<void> }

const KEY = 'install-hint-dismissed'

/**
 * Phone-only "Přidat na plochu" nudge: Android shows a real install button (beforeinstallprompt),
 * iOS Safari gets the manual Share → Add to Home Screen steps. Hidden when already installed or dismissed.
 */
export function InstallHint() {
  const [mode, setMode] = useState<'android' | 'ios' | null>(null)
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null)

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY)) return
    } catch {}
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true
    if (standalone) return
    if (/iPhone|iPad|iPod/.test(navigator.userAgent)) setMode('ios')
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setPromptEvent(e as InstallPromptEvent)
      setMode('android')
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  if (!mode) return null
  const dismiss = () => {
    try {
      localStorage.setItem(KEY, '1')
    } catch {}
    setMode(null)
  }

  return (
    <aside
      className="flex items-start gap-3 mb-6 rounded-xl border bg-card p-4 md:hidden"
      aria-label={cs.pwa.title}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-medium">{cs.pwa.title}</p>
        {mode === 'ios' ? (
          <p className="text-sm text-muted-foreground">
            {cs.pwa.ios}
            <Share className="mx-1 inline size-4 align-text-bottom" aria-hidden />
            {cs.pwa.iosEnd}
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">{cs.pwa.android}</p>
            <Button
              size="lg"
              className="mt-2"
              onClick={async () => {
                await promptEvent?.prompt()
                dismiss()
              }}
            >
              {cs.pwa.install}
            </Button>
          </>
        )}
      </div>
      <Button variant="ghost" size="icon" aria-label={cs.pwa.dismiss} onClick={dismiss}>
        <X />
      </Button>
    </aside>
  )
}
