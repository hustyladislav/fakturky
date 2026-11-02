'use client'

import { Button } from '@fakturky/ui/components/button'
import { cn } from 'cn'
import * as React from 'react'

/**
 * File input with a localized button and file name. The browser's own control always shows its
 * UI language ("Choose File"), so the native input is visually hidden and driven by our button.
 */
function FilePicker({
  id,
  className,
  buttonLabel,
  emptyLabel,
  fileName,
  ...props
}: Omit<React.ComponentProps<'input'>, 'type' | 'value'> & {
  buttonLabel: string
  emptyLabel: string
  /** Name to show; when omitted it follows the last picked file. */
  fileName?: string
}) {
  const ref = React.useRef<HTMLInputElement>(null)
  const [picked, setPicked] = React.useState('')
  const name = fileName ?? picked
  return (
    <div className={cn('flex min-w-0 items-center gap-3', className)}>
      <input
        {...props}
        ref={ref}
        id={id}
        type="file"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          setPicked(e.target.files?.[0]?.name ?? '')
          props.onChange?.(e)
        }}
      />
      <Button type="button" variant="outline" onClick={() => ref.current?.click()}>
        {buttonLabel}
      </Button>
      <span
        className={cn(
          'min-w-0 truncate text-sm',
          name ? 'text-foreground' : 'text-muted-foreground',
        )}
        title={name || undefined}
      >
        {name || emptyLabel}
      </span>
    </div>
  )
}

export { FilePicker }
