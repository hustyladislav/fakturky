import { Button } from '@fakturky/ui/components/button'
import { FieldError } from '@fakturky/ui/components/field-error'
import { Input } from '@fakturky/ui/components/input'
import { Label } from '@fakturky/ui/components/label'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { cs } from '@/i18n/cs'
import { client, orpc } from '@/lib/orpc'

type Profile = Awaited<ReturnType<typeof client.businessProfile.get>>

const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring'

export function BusinessProfileForm({
  profile,
  submitLabel,
  onSaved,
}: {
  profile: Profile
  submitLabel: string
  onSaved?: () => void | Promise<void>
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
  const set = (key: keyof typeof values) => (e: { target: { value: string } }) => {
    if (key === 'ico') setIcoError(null)
    setValues((v) => ({ ...v, [key]: e.target.value }))
  }

  const lookup = useMutation({
    mutationFn: () => client.businessProfile.lookupIco({ ico: values.ico }),
    onSuccess: (s) => {
      setValues((v) => ({
        ...v,
        ico: s.ico,
        legalName: s.name,
        dic: s.dic ?? '',
        street: s.address.street,
        city: s.address.city,
        zip: s.address.zip,
        vatStatus: s.vatPayer ? 'payer' : v.vatStatus,
        // OZ §435: sole traders are "Fyzická osoba zapsaná v živnostenském rejstříku"; companies add their court entry.
        registryNote:
          s.legalForm === '101' && !v.registryNote
            ? cs.profile.registryNoteSoleTrader
            : v.registryNote,
      }))
      setIcoError(null)
      toast.success(cs.profile.icoFound)
    },
    onError: () => setIcoError(cs.profile.icoNotFound),
  })

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

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        save.mutate()
      }}
    >
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
                lookup.mutate()
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            disabled={!values.ico || lookup.isPending}
            onClick={() => lookup.mutate()}
          >
            {lookup.isPending ? cs.common.loading : cs.profile.icoLookup}
          </Button>
        </div>
        <FieldError id="ico-error">{icoError}</FieldError>
      </div>
      <div className="space-y-2">
        <Label htmlFor="legalName">{cs.profile.legalName}</Label>
        <Input id="legalName" value={values.legalName} onChange={set('legalName')} required />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="dic">{cs.profile.dic}</Label>
          <Input id="dic" value={values.dic} onChange={set('dic')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="vatStatus">{cs.profile.vatStatus}</Label>
          <select
            id="vatStatus"
            className={selectClass}
            value={values.vatStatus}
            onChange={set('vatStatus')}
          >
            <option value="non_payer">{cs.profile.vatNonPayer}</option>
            <option value="payer">{cs.profile.vatPayer}</option>
            <option value="identified_person">{cs.profile.vatIdentified}</option>
          </select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="street">{cs.profile.street}</Label>
        <Input id="street" value={values.street} onChange={set('street')} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="city">{cs.profile.city}</Label>
          <Input id="city" value={values.city} onChange={set('city')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="zip">{cs.profile.zip}</Label>
          <Input id="zip" value={values.zip} onChange={set('zip')} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="registryNote">{cs.profile.registryNote}</Label>
        <Input id="registryNote" value={values.registryNote} onChange={set('registryNote')} />
        <p className="text-xs text-muted-foreground">{cs.profile.registryNoteHint}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="email">{cs.profile.email}</Label>
          <Input id="email" type="email" value={values.email} onChange={set('email')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">{cs.profile.phone}</Label>
          <Input id="phone" type="tel" value={values.phone} onChange={set('phone')} />
        </div>
      </div>
      <Button type="submit" disabled={save.isPending}>
        {submitLabel}
      </Button>
    </form>
  )
}
