import { Button } from '@fakturky/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@fakturky/ui/components/dialog'
import { Input } from '@fakturky/ui/components/input'
import { Label } from '@fakturky/ui/components/label'
import { type ReactNode, useEffect, useState } from 'react'
import { cs } from '@/i18n/cs'

/**
 * Accessible replacement for `window.confirm` / `window.prompt`: a confirmation with an optional
 * one-line text input (and optional extra content, e.g. a select) instead of a native browser dialog.
 */
export function PromptDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive,
  pending,
  input,
  onConfirm,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  confirmLabel: string
  destructive?: boolean
  pending?: boolean
  input?: { label: string; defaultValue?: string; required?: boolean }
  /** Receives the (trimmed) input value; empty string when there is no input. */
  onConfirm: (value: string) => void
  children?: ReactNode
}) {
  const [value, setValue] = useState(input?.defaultValue ?? '')
  // Start from the default each time the dialog opens.
  useEffect(() => {
    if (open) setValue(input?.defaultValue ?? '')
  }, [open, input?.defaultValue])
  const blocked = pending || (input?.required === true && value.trim() === '')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (!blocked) onConfirm(value.trim())
          }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          {input && (
            <div className="space-y-2">
              <Label htmlFor="prompt-input">{input.label}</Label>
              <Input
                id="prompt-input"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                autoComplete="off"
                autoFocus
              />
            </div>
          )}
          {children}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {cs.common.cancel}
            </Button>
            <Button
              type="submit"
              variant={destructive ? 'destructive' : 'default'}
              disabled={blocked}
            >
              {confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
