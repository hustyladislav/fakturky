import { isValidIco, normalizeIco } from '../ico.ts'
import { type ClientOptions, IntegrationError, request } from './fetch.ts'

const DEFAULT_BASE = 'https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty'

/** `ARES_BASE_URL` lets e2e tests point the server-side lookup at a local mock. */
const base = () => process.env.ARES_BASE_URL || DEFAULT_BASE

export interface AresAddress {
  street: string
  city: string
  zip: string
  country: string
}

export interface AresSubject {
  ico: string
  name: string
  dic: string | null
  address: AresAddress
  /** True when ARES lists the subject in the VAT register (active). */
  vatPayer: boolean
  /** Legal form code (číselník právních forem), e.g. '121' = akciová společnost. */
  legalForm: string | null
}

interface RawSidlo {
  kodStatu?: string
  nazevObce?: string
  nazevCastiObce?: string
  nazevUlice?: string
  cisloDomovni?: number
  cisloOrientacni?: number
  cisloOrientacniPismeno?: string
  psc?: number | string
  textovaAdresa?: string
}

interface RawSubject {
  ico?: string
  obchodniJmeno?: string
  dic?: string
  pravniForma?: string
  sidlo?: RawSidlo
  seznamRegistraci?: { stavZdrojeDph?: string }
}

function formatStreet(s: RawSidlo): string {
  const place = s.nazevUlice ?? s.nazevCastiObce ?? s.nazevObce ?? ''
  if (s.cisloDomovni === undefined) return place
  const orient = s.cisloOrientacni === undefined ? '' : `/${s.cisloOrientacni}${s.cisloOrientacniPismeno ?? ''}`
  return `${place} ${s.cisloDomovni}${orient}`.trim()
}

export function normalizeAresSubject(raw: RawSubject): AresSubject {
  const s = raw.sidlo ?? {}
  return {
    ico: raw.ico ?? '',
    name: raw.obchodniJmeno ?? '',
    dic: raw.dic ?? null,
    address: {
      street: formatStreet(s),
      city: s.nazevObce ?? '',
      zip: s.psc === undefined ? '' : String(s.psc).padStart(5, '0'),
      country: s.kodStatu ?? 'CZ',
    },
    vatPayer: Boolean(raw.dic) && raw.seznamRegistraci?.stavZdrojeDph === 'AKTIVNI',
    legalForm: raw.pravniForma ?? null,
  }
}

/** Looks up a subject by IČO. Returns null when ARES does not know it. Throws on a bad checksum. */
export async function lookupByIco(ico: string, opts: ClientOptions = {}): Promise<AresSubject | null> {
  const normalized = normalizeIco(ico)
  if (!isValidIco(normalized)) throw new IntegrationError(`Invalid IČO: ${ico}`, 'invalid_input')
  const res = await request(`${base()}/${normalized}`, { headers: { accept: 'application/json' } }, opts)
  if (res.status === 404) return null
  if (!res.ok) throw new IntegrationError(`ARES responded ${res.status}`, 'http_error', res.status)
  return normalizeAresSubject((await res.json()) as RawSubject)
}
