import { cs } from '@/i18n/cs'
import { COUNTRY_OPTIONS, countryLabel } from '@/lib/countries'

/** Native select for a contact's ISO country code (defaults to CZ). */
export function CountrySelect({ id, defaultValue = 'CZ' }: { id: string; defaultValue?: string }) {
  const value = defaultValue.toUpperCase()
  const options = COUNTRY_OPTIONS.includes(value) ? COUNTRY_OPTIONS : [value, ...COUNTRY_OPTIONS]
  return (
    <select
      id={id}
      name="country"
      defaultValue={value}
      aria-label={cs.contacts.country}
      className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
    >
      {options.map((c) => (
        <option key={c} value={c}>
          {countryLabel(c)}
        </option>
      ))}
    </select>
  )
}
