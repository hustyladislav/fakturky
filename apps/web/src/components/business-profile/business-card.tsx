import { Avatar } from '@fakturky/ui/components/avatar'
import { cn } from '@fakturky/ui/lib/utils'
import { Mail, Phone } from 'lucide-react'
import type { ProfileValues } from '@/components/business-profile/business-profile-form'
import { cs } from '@/i18n/cs'

const t = cs.profile

const vatLabel: Record<ProfileValues['vatStatus'], string> = {
  payer: t.vatPayer,
  non_payer: t.vatNonPayer,
  identified_person: t.vatIdentified,
}

/**
 * How the supplier appears on every invoice: a small business card with logo (or initials),
 * name, address and the register identifiers as micro-labels. Updates live while the form is edited.
 */
export function BusinessCard({
  values,
  logo,
  accent,
  className,
}: {
  values: ProfileValues
  logo?: string | null
  accent?: string | null
  className?: string
}) {
  const name = values.legalName.trim()
  const cityLine = [values.zip, values.city].filter(Boolean).join(' ')
  return (
    <figure
      className={cn('sheet relative m-0 overflow-hidden p-5', className)}
      aria-label={t.cardLabel}
      data-testid="business-card"
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-1"
        style={{ backgroundColor: accent ?? 'var(--primary)' }}
      />
      <div className="flex items-start gap-3.5">
        {logo ? (
          <img src={logo} alt="" className="size-12 shrink-0 rounded-lg object-contain" />
        ) : (
          <Avatar name={name || '?'} size="lg" shape="square" />
        )}
        <div className="min-w-0 pt-0.5">
          <p className={cn('text-xl leading-6 break-words', !name && 'text-muted-foreground/60')}>
            {name || t.cardPlaceholder}
          </p>
          <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
            {values.street || '—'}
            <br />
            {cityLine || '—'}
          </p>
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t pt-4">
        <div>
          <dt className="label-caps">{t.ico}</dt>
          <dd className="mt-0.5 text-sm tabular-nums">{values.ico || '—'}</dd>
        </div>
        <div>
          <dt className="label-caps">{t.dic}</dt>
          <dd className="mt-0.5 text-sm tabular-nums">{values.dic || '—'}</dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-muted-foreground">
        <span className="text-foreground">{vatLabel[values.vatStatus]}</span>
        {values.email && (
          <span className="inline-flex items-center gap-1.5">
            <Mail className="size-3.5" aria-hidden /> {values.email}
          </span>
        )}
        {values.phone && (
          <span className="inline-flex items-center gap-1.5 tabular-nums">
            <Phone className="size-3.5" aria-hidden /> {values.phone}
          </span>
        )}
      </div>
      <figcaption className="mt-4 text-xs text-muted-foreground">{t.cardCaption}</figcaption>
    </figure>
  )
}
