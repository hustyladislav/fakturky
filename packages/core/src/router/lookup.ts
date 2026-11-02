import { getRate, IntegrationError, lookupByIco, normalizeIco, todayPrague } from '@fakturky/domain'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { procedure } from '../orpc'
import { isoDate } from '../schemas/document'
import { cached, enforceRateLimit } from '../upstream-guard'

const tag = ['Lookup']

/** Per organization; the cache absorbs repeats, this bounds distinct lookups. */
const LOOKUPS_PER_MINUTE = 30

function wrap(e: unknown): never {
  if (e instanceof IntegrationError) {
    throw new ORPCError(e.code === 'invalid_input' ? 'BAD_REQUEST' : 'BAD_GATEWAY', {
      message: e.message,
    })
  }
  throw e
}

export const lookupRouter = {
  ares: procedure({
    mcp: {
      name: 'lookup_company_ares',
      title: 'Look up a Czech company by IČO in ARES',
      readOnly: true,
    },
    openapi: {
      method: 'GET',
      path: '/lookup/ares/{ico}',
      summary: 'Look up a company in ARES',
      tags: tag,
    },
  })
    .input(z.object({ ico: z.string().min(1).max(20) }))
    .output(
      z
        .object({
          ico: z.string(),
          name: z.string(),
          dic: z.string().nullable(),
          address: z.object({
            street: z.string(),
            city: z.string(),
            zip: z.string(),
            country: z.string(),
          }),
          vatPayer: z.boolean(),
        })
        .nullable(),
    )
    .handler(async ({ context, input }) => {
      enforceRateLimit(`ares:${context.principal.organizationId}`, LOOKUPS_PER_MINUTE)
      try {
        const ico = normalizeIco(input.ico)
        return await cached(`ares:${ico}`, 60 * 60_000, () => lookupByIco(ico))
      } catch (e) {
        return wrap(e)
      }
    }),

  exchangeRate: procedure({
    mcp: { name: 'get_exchange_rate', title: 'ČNB exchange rate (CZK per 1 unit)', readOnly: true },
    openapi: {
      method: 'GET',
      path: '/lookup/exchange-rate/{currency}',
      summary: 'ČNB exchange rate valid on a date',
      tags: tag,
    },
  })
    .input(
      z.object({
        currency: z.string().length(3),
        date: isoDate.optional(),
      }),
    )
    .output(z.object({ currency: z.string(), rate: z.string(), date: z.string() }))
    .handler(async ({ context, input }) => {
      enforceRateLimit(`rate:${context.principal.organizationId}`, LOOKUPS_PER_MINUTE)
      try {
        const date = input.date ?? todayPrague()
        return await cached(`cnb:${input.currency.toUpperCase()}:${date}`, 6 * 60 * 60_000, () =>
          getRate(input.currency, date),
        )
      } catch (e) {
        return wrap(e)
      }
    }),
}
