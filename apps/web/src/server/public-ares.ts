import { cached, enforceRateLimit } from '@fakturky/core/upstream-guard'
import { IntegrationError, isValidIco, lookupByIco, normalizeIco } from '@fakturky/domain'

/** Landing-page demo only: anonymous callers get a small per-IP budget and a shared global one. */
const PER_IP_PER_MINUTE = 8
const GLOBAL_PER_MINUTE = 120

export type PublicAresResult = { status: number; body: unknown; retryAfter?: number }

function callerKey(headers: Headers): string {
  const forwarded = headers.get('x-real-ip') ?? headers.get('x-forwarded-for')
  return forwarded?.split(',')[0]?.trim() || 'local'
}

/**
 * Public ARES proxy behind the "Zadejte IČO" demo. Only registry data (name, address, DIČ) leaves;
 * the IČO checksum is validated before any upstream call, results are cached for an hour.
 */
export async function publicAresLookup(
  headers: Headers,
  rawIco: string,
): Promise<PublicAresResult> {
  const ico = normalizeIco(rawIco)
  if (!isValidIco(ico)) return { status: 400, body: { error: 'invalid_ico' } }
  try {
    enforceRateLimit(`ares-public:ip:${callerKey(headers)}`, PER_IP_PER_MINUTE)
    enforceRateLimit('ares-public:all', GLOBAL_PER_MINUTE)
  } catch {
    return { status: 429, body: { error: 'rate_limited' }, retryAfter: 60 }
  }
  try {
    const subject = await cached(`ares:${ico}`, 60 * 60_000, () => lookupByIco(ico))
    if (!subject) return { status: 404, body: { error: 'not_found' } }
    const { name, dic, address, vatPayer } = subject
    return { status: 200, body: { ico: subject.ico, name, dic, address, vatPayer } }
  } catch (e) {
    return e instanceof IntegrationError && e.code === 'invalid_input'
      ? { status: 400, body: { error: 'invalid_ico' } }
      : { status: 502, body: { error: 'upstream' } }
  }
}
