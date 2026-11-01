import type { Db } from '@fakturky/db'
import { schema } from '@fakturky/db'
import {
  DEFAULT_NUMBER_PATTERNS,
  formatDocumentNumber,
  parseNumberPattern,
  periodKey,
  todayPrague,
} from '@fakturky/domain'
import { and, asc, eq, sql } from 'drizzle-orm'
import { DocumentError } from './documents'

const { numberSeries, numberSeriesCounter } = schema

const TYPES = [
  ['invoice', 'Faktury'],
  ['proforma', 'Zálohové faktury'],
  ['credit_note', 'Opravné doklady'],
] as const

function dateParts(today: string) {
  return { year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) }
}

/** A series that resets yearly/monthly must put the period in the number, or numbers repeat. */
export function validatePattern(pattern: string, reset: 'yearly' | 'never') {
  let tokens: ReturnType<typeof parseNumberPattern>
  try {
    tokens = parseNumberPattern(pattern)
  } catch (e) {
    throw new DocumentError('BAD_REQUEST', (e as Error).message)
  }
  if (reset === 'yearly' && !tokens.some((t) => t.type === 'year4' || t.type === 'year2')) {
    throw new DocumentError('BAD_REQUEST', 'A yearly series needs {YYYY} or {YY} in the pattern')
  }
}

async function describe(db: Db, orgId: string, today: string) {
  const rows = await db
    .select()
    .from(numberSeries)
    .where(eq(numberSeries.organizationId, orgId))
    .orderBy(asc(numberSeries.documentType), asc(numberSeries.createdAt))
  const date = dateParts(today)
  const out = []
  for (const s of rows) {
    const [counter] = await db
      .select()
      .from(numberSeriesCounter)
      .where(
        and(
          eq(numberSeriesCounter.organizationId, orgId),
          eq(numberSeriesCounter.seriesId, s.id),
          eq(numberSeriesCounter.period, periodKey(s.reset, date)),
        ),
      )
    const next = counter?.nextValue ?? 1
    out.push({
      id: s.id,
      documentType: s.documentType,
      name: s.name,
      pattern: s.pattern,
      reset: s.reset,
      isDefault: s.isDefault,
      nextValue: next,
      nextNumber: formatDocumentNumber(s.pattern, next, date),
    })
  }
  return out
}

export const numberSeriesRepo = {
  /** Lists the series, creating the default ones for invoices, proformas and credit notes on first use. */
  async list(db: Db, orgId: string, today = todayPrague()) {
    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`series:${orgId}`}))`)
      const existing = await tx
        .select({ type: numberSeries.documentType })
        .from(numberSeries)
        .where(and(eq(numberSeries.organizationId, orgId), eq(numberSeries.isDefault, true)))
      for (const [type, name] of TYPES) {
        if (existing.some((e) => e.type === type)) continue
        await tx.insert(numberSeries).values({
          organizationId: orgId,
          documentType: type,
          name,
          pattern: DEFAULT_NUMBER_PATTERNS[type],
          reset: 'yearly',
        })
      }
    })
    return describe(db, orgId, today)
  },

  async update(
    db: Db,
    orgId: string,
    id: string,
    patch: { name?: string; pattern?: string },
    today = todayPrague(),
  ) {
    const [s] = await db
      .select()
      .from(numberSeries)
      .where(and(eq(numberSeries.organizationId, orgId), eq(numberSeries.id, id)))
    if (!s) return null
    if (patch.pattern !== undefined) validatePattern(patch.pattern, s.reset)
    await db
      .update(numberSeries)
      .set(patch)
      .where(and(eq(numberSeries.organizationId, orgId), eq(numberSeries.id, id)))
    return (await describe(db, orgId, today)).find((x) => x.id === id) ?? null
  },

  /**
   * Continue numbering from another system: raises the next counter value of the current period.
   * Never lowers it (numbers are never reused).
   */
  async setNext(db: Db, orgId: string, id: string, value: number, today = todayPrague()) {
    const [s] = await db
      .select()
      .from(numberSeries)
      .where(and(eq(numberSeries.organizationId, orgId), eq(numberSeries.id, id)))
    if (!s) return null
    const period = periodKey(s.reset, dateParts(today))
    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`${orgId}:${s.documentType}`}))`)
      const [c] = await tx
        .select()
        .from(numberSeriesCounter)
        .where(
          and(
            eq(numberSeriesCounter.organizationId, orgId),
            eq(numberSeriesCounter.seriesId, id),
            eq(numberSeriesCounter.period, period),
          ),
        )
      if (c && value < c.nextValue) {
        throw new DocumentError('CONFLICT', 'The next number can only be raised, never lowered')
      }
      if (c) {
        await tx
          .update(numberSeriesCounter)
          .set({ nextValue: value })
          .where(
            and(eq(numberSeriesCounter.organizationId, orgId), eq(numberSeriesCounter.id, c.id)),
          )
      } else {
        await tx
          .insert(numberSeriesCounter)
          .values({ organizationId: orgId, seriesId: id, period, nextValue: value })
      }
    })
    return (await describe(db, orgId, today)).find((x) => x.id === id) ?? null
  },
}
