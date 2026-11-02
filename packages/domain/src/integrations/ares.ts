import { isValidIco, normalizeIco } from '../ico.ts'
import { type ClientOptions, IntegrationError, request } from './fetch.ts'

const DEFAULT_BASE = 'https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty'

/** `ARES_BASE_URL` lets e2e tests point the server-side lookup at a local mock. */
const base = () => process.env.ARES_BASE_URL || DEFAULT_BASE
/** The VR source is a sibling endpoint; a mock base gets a `/vr` suffix instead. */
const vrBase = () =>
  base().endsWith('/ekonomicke-subjekty') ? `${base()}-vr` : `${base()}/vr`

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
  /** Ready-made "zápis v rejstříku" line: živnostenský rejstřík for sole traders, spisová značka for companies. */
  registryNote: string | null
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
  seznamRegistraci?: { stavZdrojeDph?: string; stavZdrojeVr?: string }
}

interface RawVrRecord {
  rejstrik?: string
  primarniZaznam?: boolean
  spisovaZnacka?: { datumVymazu?: string; soud?: string; oddil?: string; vlozka?: number | string }[]
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
    registryNote: raw.pravniForma === SOLE_TRADER ? SOLE_TRADER_NOTE : null,
  }
}

const SOLE_TRADER = '101'
// OZ §435: sole traders are "Fyzická osoba zapsaná v živnostenském rejstříku".
const SOLE_TRADER_NOTE = 'Fyzická osoba zapsaná v živnostenském rejstříku.'

/** Instrumental case, as the sentence "vedeném …" needs it. */
const COURTS: Record<string, string> = {
  MSPH: 'Městským soudem v Praze',
  KSCB: 'Krajským soudem v Českých Budějovicích',
  KSPL: 'Krajským soudem v Plzni',
  KSUL: 'Krajským soudem v Ústí nad Labem',
  KSHK: 'Krajským soudem v Hradci Králové',
  KSBR: 'Krajským soudem v Brně',
  KSOS: 'Krajským soudem v Ostravě',
}

/** "Zapsána v obchodním rejstříku vedeném … , oddíl B, vložka 8573." from the ARES VR (veřejný rejstřík) record. */
export function registryNoteFromVr(raw: { zaznamy?: RawVrRecord[] }): string | null {
  const rec = raw.zaznamy?.find((r) => r.rejstrik === 'OR' && r.primarniZaznam) ?? raw.zaznamy?.[0]
  const sz = rec?.spisovaZnacka?.findLast((z) => !z.datumVymazu)
  if (!rec || rec.rejstrik !== 'OR' || !sz?.soud || !sz.oddil || sz.vlozka === undefined) return null
  const court = COURTS[sz.soud]
  return court
    ? `Zapsána v obchodním rejstříku vedeném ${court}, oddíl ${sz.oddil}, vložka ${sz.vlozka}.`
    : `Zapsána v obchodním rejstříku, spisová značka ${sz.oddil} ${sz.vlozka}/${sz.soud}.`
}

/** Looks up a subject by IČO. Returns null when ARES does not know it. Throws on a bad checksum. */
export async function lookupByIco(
  ico: string,
  opts: ClientOptions & { withRegistryNote?: boolean } = {},
): Promise<AresSubject | null> {
  const { withRegistryNote, ...clientOpts } = opts
  const normalized = normalizeIco(ico)
  if (!isValidIco(normalized)) throw new IntegrationError(`Invalid IČO: ${ico}`, 'invalid_input')
  const res = await request(`${base()}/${normalized}`, { headers: { accept: 'application/json' } }, clientOpts)
  if (res.status === 404) return null
  if (!res.ok) throw new IntegrationError(`ARES responded ${res.status}`, 'http_error', res.status)
  const raw = (await res.json()) as RawSubject
  const subject = normalizeAresSubject(raw)
  if (withRegistryNote && raw.seznamRegistraci?.stavZdrojeVr === 'AKTIVNI') {
    subject.registryNote = await lookupRegistryNote(normalized, clientOpts)
  }
  return subject
}

/** Best effort: the main lookup must not fail because the VR source is slow or down. */
async function lookupRegistryNote(ico: string, opts: ClientOptions): Promise<string | null> {
  try {
    const res = await request(
      `${vrBase()}/${ico}`,
      { headers: { accept: 'application/json' } },
      opts,
    )
    return res.ok ? registryNoteFromVr((await res.json()) as { zaznamy?: RawVrRecord[] }) : null
  } catch {
    return null
  }
}
