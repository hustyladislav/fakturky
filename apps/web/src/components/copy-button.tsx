import { cn } from '@fakturky/ui/lib/utils'
import { Check, Copy } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

/** Copies `text` and reports `copied` for a moment; `onFail` runs when the browser refuses. */
export function useCopy(text: string, onFail?: () => void) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const copy = () =>
    Promise.resolve(navigator.clipboard?.writeText(text))
      .then(() => {
        if (!navigator.clipboard) return onFail?.()
        setCopied(true)
        clearTimeout(timer.current)
        timer.current = setTimeout(() => setCopied(false), 1600)
      })
      .catch(() => onFail?.())
  return { copied, copy }
}

/** Icon button that copies `text` and confirms with a check for a moment; `data-copied` is set meanwhile. */
export function CopyButton({
  text,
  labels,
  className,
}: {
  text: string
  labels: { copy: string; copied: string }
  className: string
}) {
  const { copied: done, copy } = useCopy(text)
  const label = done ? labels.copied : labels.copy
  return (
    <button
      type="button"
      onClick={copy}
      className={cn(
        'inline-flex size-8 items-center justify-center rounded-md transition-colors focus-visible:outline-none pointer-coarse:size-11',
        className,
      )}
      aria-label={label}
      title={label}
      data-copied={done || undefined}
    >
      {done ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
    </button>
  )
}
