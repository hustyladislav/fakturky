import { Decimal, parseDecimal } from '../money.ts'
import { addDays, formatDateDotted, type IsoDate } from '../dates.ts'
import { type ClientOptions, IntegrationError, request } from './fetch.ts'

const URL_BASE =
  'https://www.cnb.cz/cs/financni-trhy/devizovy-trh/kurzy-devizoveho-trhu/kurzy-devizoveho-trhu/denni_kurz.txt'

export interface CnbRate {
  country: string
  currencyName: string
  code: string
  /** Units of foreign currency the rate refers to (e.g. 100 for THB). */
  amount: number
  /** CZK for `amount` units, as published. */
  rate: string
  /** CZK for exactly one unit (rate / amount), full precision. */
  perUnit: string
}

export interface CnbDaily {
  /** Effective date of the publication, `YYYY-MM-DD`. */
  date: IsoDate
  serial: number
  rates: Record<string, CnbRate>
}

/** Parses the ČNB `denni_kurz.txt` body. */
export function parseCnbDaily(text: string): CnbDaily {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '')
  const head = /^(\d{2})\.(\d{2})\.(\d{4}) #(\d+)/.exec(lines[0] ?? '')
  if (!head) throw new IntegrationError('Unrecognized ČNB header', 'bad_response')
  const rates: Record<string, CnbRate> = {}
  for (const line of lines.slice(2)) {
    const [country, currencyName, amountStr, code, rateStr] = line.split('|')
    if (!country || !currencyName || !amountStr || !code || !rateStr) {
      throw new IntegrationError(`Malformed ČNB line: ${line}`, 'bad_response')
    }
    const amount = Number(amountStr)
    const rate = parseDecimal(rateStr)
    rates[code] = {
      country,
      currencyName,
      code,
      amount,
      rate: rate.toString(),
      perUnit: rate.div(new Decimal(amount)).toString(),
    }
  }
  return { date: `${head[3]}-${head[2]}-${head[1]}`, serial: Number(head[4]), rates }
}

export async function fetchCnbDaily(date: IsoDate, opts: ClientOptions = {}): Promise<CnbDaily> {
  const res = await request(`${URL_BASE}?date=${formatDateDotted(date)}`, {}, opts)
  if (!res.ok) throw new IntegrationError(`ČNB responded ${res.status}`, 'http_error', res.status)
  return parseCnbDaily(await res.text())
}

export interface CnbRateResult {
  currency: string
  /** CZK per one unit of currency. */
  rate: string
  /** Date of the publication actually used (earlier than requested on weekends/holidays). */
  date: IsoDate
}

/**
 * Rate of `currency` valid on `date`. ČNB serves the last published rates for weekends and holidays,
 * so the result date can precede the requested one. If the response is empty, steps back up to 7 days.
 */
export async function getRate(
  currency: string,
  date: IsoDate,
  opts: ClientOptions = {},
): Promise<CnbRateResult> {
  const code = currency.toUpperCase()
  if (code === 'CZK') return { currency: code, rate: '1', date }
  let lastError: unknown
  for (let back = 0; back < 7; back++) {
    const d = addDays(date, -back)
    try {
      const daily = await fetchCnbDaily(d, opts)
      const r = daily.rates[code]
      if (!r) throw new IntegrationError(`ČNB has no rate for ${code}`, 'invalid_input')
      return { currency: code, rate: r.perUnit, date: daily.date }
    } catch (e) {
      if (e instanceof IntegrationError && e.code === 'invalid_input') throw e
      lastError = e
    }
  }
  throw lastError instanceof Error ? lastError : new IntegrationError('No ČNB rates found', 'bad_response')
}
