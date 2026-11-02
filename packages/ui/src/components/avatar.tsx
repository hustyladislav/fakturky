import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from 'cn'

const avatarVariants = cva(
  'inline-flex shrink-0 items-center justify-center rounded-full font-semibold select-none',
  {
    variants: {
      size: {
        xs: 'size-5 text-[9px]',
        sm: 'size-7 text-[11px]',
        md: 'size-9 text-xs',
        lg: 'size-12 text-base',
        xl: 'size-16 font-serif text-2xl',
      },
      shape: { round: 'rounded-full', square: 'rounded-lg' },
    },
    defaultVariants: { size: 'md', shape: 'round' },
  },
)

const LEGAL =
  /^(s\.?\s?r\.?\s?o\.?|a\.?\s?s\.?|spol\.?|z\.?\s?s\.?|o\.?\s?p\.?\s?s\.?|k\.?\s?s\.?|v\.?\s?o\.?\s?s\.?|gmbh|ltd\.?|inc\.?|llc|ag|se|&|a)$/i

/** Up to two initials, ignoring legal forms ("Studio Lípa s.r.o." -> "SL"). */
export function initials(name: string): string {
  const words = name
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}.&]/gu, ''))
    .filter((w) => w && !LEGAL.test(w))
  const first = words[0]
  if (!first) return name.trim().charAt(0).toUpperCase() || '?'
  const last = words.length > 1 ? words[words.length - 1] : undefined
  const chars = last ? `${first.charAt(0)}${last.charAt(0)}` : first.slice(0, 2)
  return chars.toUpperCase()
}

/** Deterministic 1..6 from the name (djb2). */
export function avatarHue(name: string): 1 | 2 | 3 | 4 | 5 | 6 {
  let h = 5381
  for (const c of name.trim().toLowerCase()) h = ((h << 5) + h + c.charCodeAt(0)) | 0
  return ((Math.abs(h) % 6) + 1) as 1 | 2 | 3 | 4 | 5 | 6
}

/**
 * Tinted initials avatar. The tint is one of six muted hues picked from the name, so the same
 * contact looks the same everywhere. Decorative by default (the name is shown next to it).
 */
function Avatar({
  name,
  size,
  shape,
  className,
}: { name: string; className?: string } & VariantProps<typeof avatarVariants>) {
  const hue = avatarHue(name)
  return (
    <span
      aria-hidden
      data-slot="avatar"
      className={cn(avatarVariants({ size, shape }), className)}
      style={{
        backgroundColor: `color-mix(in srgb, var(--avatar-${hue}) 16%, var(--card))`,
        color: `color-mix(in srgb, var(--avatar-${hue}) 85%, var(--foreground))`,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, var(--avatar-${hue}) 22%, transparent)`,
      }}
    >
      {initials(name)}
    </span>
  )
}

export { Avatar, avatarVariants }
