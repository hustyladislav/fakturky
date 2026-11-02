import { cn } from 'cn'

/** Inline validation message shown under a field (pair with `aria-invalid` + `aria-describedby`). */
function FieldError({ id, className, children }: React.ComponentProps<'p'>) {
  if (!children) return null
  return (
    <p id={id} role="alert" className={cn('text-xs text-destructive', className)}>
      {children}
    </p>
  )
}

export { FieldError }
