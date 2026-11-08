import { Button } from '@fakturky/ui/components/button'
import { FieldError } from '@fakturky/ui/components/field-error'
import { Input } from '@fakturky/ui/components/input'
import { Label } from '@fakturky/ui/components/label'
import { ChevronDown } from 'lucide-react'
import { forwardRef } from 'react'
import { ProfileFields, type SetField, VatStatusSelect } from '@/components/business-profile-fields'
import type { ProfileValues } from '@/components/business-profile-form'
import { cs } from '@/i18n/cs'

const t = cs.onboarding

/** Step 1 before ARES answered: one question, one action, and the way out for people without an IČO. */
export function IcoEntry({
  values,
  set,
  error,
  pending,
  onManual,
}: {
  values: ProfileValues
  set: SetField
  error: string | null
  pending: boolean
  onManual: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="ico">{cs.profile.ico}</Label>
        <div className="flex gap-2">
          <Input
            id="ico"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'ico-error' : undefined}
            value={values.ico}
            onChange={set('ico')}
          />
          <Button type="submit" disabled={!values.ico || pending}>
            {pending ? cs.common.loading : cs.profile.icoLookup}
          </Button>
        </div>
        <FieldError id="ico-error">{error}</FieldError>
      </div>
      <Button
        type="button"
        variant="link"
        className="h-11 px-0 text-muted-foreground"
        onClick={onManual}
      >
        {t.manual}
      </Button>
    </div>
  )
}

/**
 * ARES answered: the company read-only, the VAT status the person may correct, every other
 * profile field one "Upravit údaje" away, and a single Pokračovat (focused, so Enter continues).
 */
export const FoundSummary = forwardRef<
  HTMLButtonElement,
  {
    values: ProfileValues
    set: SetField
    editing: boolean
    saving: boolean
    submitLabel: string
    onToggleEditing: () => void
    onChangeIco: () => void
  }
>(function FoundSummary(
  { values, set, editing, saving, submitLabel, onToggleEditing, onChangeIco },
  continueRef,
) {
  const cityLine = [values.zip, values.city].filter(Boolean).join(' ')
  const ids = [`${cs.profile.ico} ${values.ico}`, values.dic && `${cs.profile.dic} ${values.dic}`]
  return (
    <div className="space-y-5">
      <div data-testid="profile-summary" className="border-y py-5">
        <p className="text-xl leading-7 break-words">{values.legalName}</p>
        <p className="mt-1.5 text-sm leading-5 text-muted-foreground">
          {values.street}
          {values.street && cityLine && <br />}
          {cityLine}
        </p>
        <p className="mt-3 flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground tabular-nums">
          <span>{ids.filter(Boolean).join(' · ')}</span>
          <Button
            type="button"
            variant="link"
            className="h-auto px-0 pointer-coarse:h-11"
            onClick={onChangeIco}
          >
            {t.changeIco}
          </Button>
        </p>
      </div>

      <VatStatusSelect values={values} set={set} />

      <div>
        <Button
          type="button"
          variant="link"
          className="h-11 gap-1 px-0 text-muted-foreground"
          aria-expanded={editing}
          aria-controls="profile-details"
          onClick={onToggleEditing}
        >
          {t.editDetails}
          <ChevronDown
            aria-hidden
            className={editing ? 'rotate-180 transition-transform' : 'transition-transform'}
          />
        </Button>
        {editing && (
          <div id="profile-details" className="mt-2 space-y-4">
            <ProfileFields values={values} set={set} vatStatus={false} />
          </div>
        )}
      </div>

      <Button ref={continueRef} type="submit" size="lg" className="h-11 w-full" disabled={saving}>
        {submitLabel}
      </Button>
    </div>
  )
})
