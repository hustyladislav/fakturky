import { isValidIco } from '@fakturky/domain/ico'
import { Button } from '@fakturky/ui/components/button'
import { FieldError } from '@fakturky/ui/components/field-error'
import { Input } from '@fakturky/ui/components/input'
import { Label } from '@fakturky/ui/components/label'
import { ORPCError } from '@orpc/client'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ProfileFields } from '@/components/business-profile-fields'
import { FoundSummary, IcoEntry } from '@/components/business-profile-ico-first'
import { cs } from '@/i18n/cs'
import { client, orpc } from '@/lib/orpc'

type Profile = Awaited<ReturnType<typeof client.businessProfile.get>>

export type ProfileValues = {
  legalName: string
  ico: string
  dic: string
  street: string
  city: string
  zip: string
  vatStatus: Profile['vatStatus']
  registryNote: string
  email: string
  phone: string
}

/** `full`: every field at once (Nastavení). `ico-first`: onboarding, one question, then an ARES summary. */
export type ProfileFormMode = 'full' | 'ico-first'

type IcoFirstPhase = 'ico' | 'found' | 'manual'

export function BusinessProfileForm({
  profile,
  submitLabel,
  mode = 'full',
  onSaved,
  onValuesChange,
}: {
  profile: Profile
  submitLabel: string
  mode?: ProfileFormMode
  onSaved?: () => void | Promise<void>
  /** Live values, for a preview next to the form. */
  onValuesChange?: (values: ProfileValues) => void
}) {
  const queryClient = useQueryClient()
  const [values, setValues] = useState({
    legalName: profile.onboardedAt || profile.legalName !== 'Moje firma' ? profile.legalName : '',
    ico: profile.ico ?? '',
    dic: profile.dic ?? '',
    street: profile.address.street ?? '',
    city: profile.address.city ?? '',
    zip: profile.address.zip ?? '',
    vatStatus: profile.vatStatus,
    registryNote: profile.registryNote ?? '',
    email: profile.email ?? '',
    phone: profile.phone ?? '',
  })
  const [icoError, setIcoError] = useState<string | null>(null)
  const icoFirst = mode === 'ico-first'
  const [phase, setPhase] = useState<IcoFirstPhase>('ico')
  const [editing, setEditing] = useState(false)
  const continueButton = useRef<HTMLButtonElement>(null)
  useEffect(() => onValuesChange?.(values), [values, onValuesChange])
  const set = (key: keyof typeof values) => (e: { target: { value: string } }) => {
    if (key === 'ico') setIcoError(null)
    setValues((v) => ({ ...v, [key]: e.target.value }))
  }

  const lookup = useMutation({
    mutationFn: (ico: string) => client.businessProfile.lookupIco({ ico }),
    onSuccess: (s) => {
      setValues((v) => ({
        ...v,
        ico: s.ico,
        legalName: s.name,
        dic: s.dic ?? '',
        street: s.address.street,
        city: s.address.city,
        zip: s.address.zip,
        // ARES is the source of truth for the VAT register; keep only a manually chosen "identified person".
        vatStatus: s.vatPayer
          ? 'payer'
          : v.vatStatus === 'identified_person'
            ? v.vatStatus
            : 'non_payer',
        registryNote: s.registryNote ?? v.registryNote,
      }))
      setIcoError(null)
      if (!icoFirst) toast.success(cs.profile.icoFound)
      else if (phase === 'ico') setPhase('found')
    },
    onError: (error) =>
      setIcoError(
        icoFirst && error instanceof ORPCError && error.code === 'BAD_GATEWAY'
          ? cs.profile.icoAresDown
          : icoFirst && error instanceof ORPCError && error.code === 'BAD_REQUEST'
            ? cs.profile.icoInvalid
            : cs.profile.icoNotFound,
      ),
  })

  // A complete, valid IČO looks itself up; the button stays as a fallback for short or padded numbers.
  const lastAuto = useRef('')
  useEffect(() => {
    const ico = values.ico.replace(/\s/g, '')
    if (!isValidIco(ico) || ico.length !== 8 || ico === lastAuto.current) return
    lastAuto.current = ico
    lookup.mutate(ico)
  }, [values.ico, lookup.mutate])

  // Enter should continue straight from the summary.
  useEffect(() => {
    if (phase === 'found') continueButton.current?.focus()
  }, [phase])

  const save = useMutation({
    mutationFn: () =>
      client.businessProfile.update({
        legalName: values.legalName,
        ico: values.ico || null,
        dic: values.dic || null,
        address: { street: values.street, city: values.city, zip: values.zip, country: 'CZ' },
        vatStatus: values.vatStatus,
        registryNote: values.registryNote || null,
        email: values.email || null,
        phone: values.phone || null,
      }),
    onSuccess: async () => {
      toast.success(cs.settings.profileSaved)
      await queryClient.invalidateQueries({ queryKey: orpc.businessProfile.key() })
      await onSaved?.()
    },
    onError: () => toast.error(cs.common.error),
  })

  const icoRow = (
    <div className="space-y-2">
      <Label htmlFor="ico">{cs.profile.ico}</Label>
      <div className="flex gap-2">
        <Input
          id="ico"
          inputMode="numeric"
          aria-invalid={icoError ? true : undefined}
          aria-describedby={icoError ? 'ico-error' : undefined}
          value={values.ico}
          onChange={set('ico')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && values.ico) {
              e.preventDefault()
              lookup.mutate(values.ico)
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={!values.ico || lookup.isPending}
          onClick={() => lookup.mutate(values.ico)}
        >
          {lookup.isPending ? cs.common.loading : cs.profile.icoLookup}
        </Button>
      </div>
      <FieldError id="ico-error">{icoError}</FieldError>
    </div>
  )

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (icoFirst && phase === 'ico') {
          if (values.ico && !lookup.isPending) lookup.mutate(values.ico)
          return
        }
        save.mutate()
      }}
    >
      {icoFirst && phase === 'ico' ? (
        <IcoEntry
          values={values}
          set={set}
          error={icoError}
          pending={lookup.isPending}
          onManual={() => setPhase('manual')}
        />
      ) : icoFirst && phase === 'found' ? (
        <FoundSummary
          ref={continueButton}
          values={values}
          set={set}
          editing={editing}
          saving={save.isPending}
          submitLabel={submitLabel}
          onToggleEditing={() => setEditing((v) => !v)}
          onChangeIco={() => setPhase('ico')}
        />
      ) : (
        <>
          {icoRow}
          <ProfileFields values={values} set={set} vatStatus />
          <Button type="submit" disabled={save.isPending}>
            {submitLabel}
          </Button>
        </>
      )}
    </form>
  )
}
