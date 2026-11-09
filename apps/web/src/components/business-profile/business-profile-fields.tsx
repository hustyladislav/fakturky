import { Input } from '@fakturky/ui/components/input'
import { Label } from '@fakturky/ui/components/label'
import { NativeSelect } from '@fakturky/ui/components/native-select'
import type { ProfileValues } from '@/components/business-profile/business-profile-form'
import { cs } from '@/i18n/cs'

export type SetField = (key: keyof ProfileValues) => (e: { target: { value: string } }) => void

export function VatStatusSelect({ values, set }: { values: ProfileValues; set: SetField }) {
  return (
    <div className="space-y-2">
      <Label htmlFor="vatStatus">{cs.profile.vatStatus}</Label>
      <NativeSelect id="vatStatus" value={values.vatStatus} onChange={set('vatStatus')}>
        <option value="non_payer">{cs.profile.vatNonPayer}</option>
        <option value="payer">{cs.profile.vatPayer}</option>
        <option value="identified_person">{cs.profile.vatIdentified}</option>
      </NativeSelect>
    </div>
  )
}

/** Everything the profile holds besides the IČO. VAT status can live elsewhere (the ARES summary). */
export function ProfileFields({
  values,
  set,
  vatStatus,
}: {
  values: ProfileValues
  set: SetField
  vatStatus: boolean
}) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="legalName">{cs.profile.legalName}</Label>
        <Input id="legalName" value={values.legalName} onChange={set('legalName')} required />
      </div>
      <div className={vatStatus ? 'grid gap-4 sm:grid-cols-2' : undefined}>
        <div className="space-y-2">
          <Label htmlFor="dic">{cs.profile.dic}</Label>
          <Input id="dic" value={values.dic} onChange={set('dic')} />
        </div>
        {vatStatus && <VatStatusSelect values={values} set={set} />}
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
    </>
  )
}
