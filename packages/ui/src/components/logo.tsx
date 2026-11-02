import { cn } from 'cn'

/**
 * Brand mark: a rounded square with the brand's first letter and a period.
 * The period is the one semantic element (`data-paid` fills it). Pass `letter` from BRAND.name.
 */
function LogoMark({
  letter,
  className,
  paid = false,
}: {
  letter: string
  className?: string
  paid?: boolean
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn('size-8 shrink-0', className)}
      aria-hidden="true"
      data-paid={paid || undefined}
    >
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <text
        x="8.5"
        y="23"
        className="fill-primary-foreground"
        style={{
          fontFamily: 'var(--font-serif)',
          fontWeight: 400,
          fontSynthesis: 'none',
          fontSize: 23,
        }}
      >
        {letter.charAt(0).toUpperCase()}
      </text>
      <circle
        cx="24.5"
        cy="21.6"
        r="2.1"
        className={cn(
          'transition-[fill] duration-1000',
          paid ? 'fill-primary-foreground' : 'fill-primary-foreground/45',
        )}
      />
    </svg>
  )
}

/** Mark + wordmark (Geist Serif 400). */
function Logo({
  name,
  className,
  markClassName,
}: {
  name: string
  className?: string
  markClassName?: string
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark letter={name.charAt(0)} className={markClassName} />
      <span className="font-serif text-xl tracking-tight">{name}</span>
    </span>
  )
}

export { Logo, LogoMark }
