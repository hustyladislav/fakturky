import { Button } from '@fakturky/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@fakturky/ui/components/dropdown-menu'
import { cn } from '@fakturky/ui/lib/utils'
import { CalendarClock, Check, ChevronDown, Share2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { cs } from '@/i18n/cs'

const t = cs.invoices.detail

export type ShareTarget = {
  /** Public link of the document. */
  url: string
  pdfUrl: string
  title: string
  text: string
  fileName: string
}

/** A phone-like device whose share sheet (WhatsApp, Messages, Mail) beats a bare clipboard copy. */
function prefersNativeShare(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    window.matchMedia('(pointer: coarse)').matches
  )
}

async function buildShareData(target: ShareTarget): Promise<ShareData> {
  const link: ShareData = { title: target.title, text: target.text, url: target.url }
  try {
    const res = await fetch(target.pdfUrl)
    if (!res.ok) return link
    const file = new File([await res.blob()], target.fileName, { type: 'application/pdf' })
    if (navigator.canShare?.({ files: [file] })) {
      // Targets that take files often drop `url`, so the link rides in the text.
      return { title: target.title, text: `${target.text}\n${target.url}`, files: [file] }
    }
  } catch {
    /* PDF unavailable: share the link alone */
  }
  return link
}

/** Share (native sheet on phones) or copy the public link with a visible "copied" state. */
export function useShareLink() {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  const share = useCallback(async (target: ShareTarget) => {
    if (prefersNativeShare()) {
      try {
        await navigator.share(await buildShareData(target))
        return
      } catch (e) {
        if ((e as { name?: string }).name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(target.url)
    } catch {
      toast.error(t.copyFailed)
      return
    }
    setCopied(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 2500)
    toast.success(t.linkCopied)
  }, [])

  return { share, copied }
}

export function ShareButton({
  copied,
  onShare,
  variant = 'default',
  size = 'default',
  className,
}: {
  copied: boolean
  onShare: () => void
  variant?: 'default' | 'outline'
  size?: 'default' | 'lg'
  className?: string
}) {
  return (
    <Button variant={variant} size={size} className={className} onClick={onShare}>
      {copied ? <Check /> : <Share2 />}
      <span aria-live="polite">{copied ? t.shareCopied : t.share}</span>
    </Button>
  )
}

/** One click pays the remaining amount today; the caret opens the amount/date form. */
export function PaySplitButton({
  variant = 'default',
  className,
  disabled,
  onPayNow,
  onMore,
}: {
  variant?: 'default' | 'outline'
  className?: string
  disabled?: boolean
  onPayNow: () => void
  onMore: () => void
}) {
  return (
    <div className={cn('flex', className)} role="group" aria-label={t.markPaid}>
      <Button
        variant={variant}
        className="h-full min-w-0 flex-1 rounded-r-none"
        disabled={disabled}
        onClick={onPayNow}
      >
        {t.markPaid}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={t.markPaidMore}
          disabled={disabled}
          render={
            <Button
              variant={variant}
              className={cn(
                'h-full rounded-l-none border-l px-2',
                variant === 'default' && 'border-l-primary-foreground/25',
              )}
            />
          }
        >
          <ChevronDown aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="bottom" align="end">
          <DropdownMenuItem onClick={onMore}>
            <CalendarClock aria-hidden /> {t.markPaidOther}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
