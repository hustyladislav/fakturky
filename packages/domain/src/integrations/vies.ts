import { parseVatId } from '../dic.ts'
import { type ClientOptions, IntegrationError, request } from './fetch.ts'

const URL = 'https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number'

export interface ViesResult {
  valid: boolean
  countryCode: string
  vatNumber: string
  name: string | null
  address: string | null
  /** ISO timestamp from VIES. */
  requestDate: string
}

/** Checks an EU VAT ID (e.g. `CZ26168685`) against VIES. */
export async function checkVatId(vatId: string, opts: ClientOptions = {}): Promise<ViesResult> {
  const parsed = parseVatId(vatId)
  if (!parsed) throw new IntegrationError(`Unsupported VAT ID: ${vatId}`, 'invalid_input')
  const res = await request(
    URL,
    {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({ countryCode: parsed.countryCode, vatNumber: parsed.number }),
    },
    opts,
  )
  if (!res.ok) throw new IntegrationError(`VIES responded ${res.status}`, 'http_error', res.status)
  const b = (await res.json()) as Record<string, unknown>
  if (typeof b.valid !== 'boolean') throw new IntegrationError('Unexpected VIES response', 'bad_response')
  const clean = (v: unknown) => (typeof v === 'string' && v !== '---' && v.trim() !== '' ? v : null)
  return {
    valid: b.valid,
    countryCode: parsed.countryCode,
    vatNumber: parsed.number,
    name: clean(b.name),
    address: clean(b.address),
    requestDate: String(b.requestDate ?? ''),
  }
}
