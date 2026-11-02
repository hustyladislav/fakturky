import { randomBytes } from 'node:crypto'
import type { Db } from '@fakturky/db'
import { schema } from '@fakturky/db'
import {
  computeDocumentTotals,
  DEFAULT_NUMBER_PATTERNS,
  Decimal,
  parseDecimal,
  parseNumber,
  periodKey,
  toFixed,
  variableSymbolFromNumber,
} from '@fakturky/domain'
import { and, asc, eq, or, sql } from 'drizzle-orm'
import type {
  ImportBatch,
  ImportContact,
  ImportDocument,
  ImportIssue,
  ImportSource,
  ImportSummary,
} from '../import/types'

const { document, documentLine, payment, activity, businessProfile, contact, numberSeries } = schema

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]

/** CSV imports mark "paid" without an amount; it means the full total. */
export const PAID_IN_FULL = '__total__'

class Rollback extends Error {}

class SkipDocument extends Error {}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

async function upsertContact(
  tx: Tx,
  orgId: string,
  c: ImportContact,
): Promise<{ id: string; created: boolean }> {
  const rows = await tx.select().from(contact).where(eq(contact.organizationId, orgId))
  const norm = (s: string) => s.trim().toLowerCase()
  const found =
    (c.externalId ? rows.find((r) => r.externalId === c.externalId) : undefined) ??
    (c.ico ? rows.find((r) => r.ico === c.ico) : undefined) ??
    rows.find((r) => norm(r.name) === norm(c.name))
  if (found) return { id: found.id, created: false }
  const [row] = await tx
    .insert(contact)
    .values({
      organizationId: orgId,
      name: c.name.slice(0, 200),
      ico: c.ico ?? null,
      dic: c.dic ?? null,
      icDph: c.icDph ?? null,
      address: c.address,
      country: c.country,
      emails: c.emails,
      phone: c.phone ?? null,
      note: c.note ?? null,
      externalId: c.externalId ?? null,
    })
    .returning({ id: contact.id })
  if (!row) throw new Error('contact insert failed')
  return { id: row.id, created: true }
}

async function defaultSeries(tx: Tx, orgId: string, type: ImportDocument['type']) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`${orgId}:${type}`}))`)
  const [existing] = await tx
    .select()
    .from(numberSeries)
    .where(
      and(
        eq(numberSeries.organizationId, orgId),
        eq(numberSeries.documentType, type),
        eq(numberSeries.isDefault, true),
      ),
    )
    .orderBy(asc(numberSeries.createdAt))
  if (existing) return existing
  const [created] = await tx
    .insert(numberSeries)
    .values({
      organizationId: orgId,
      documentType: type,
      name: type === 'invoice' ? 'Faktury' : type,
      pattern: DEFAULT_NUMBER_PATTERNS[type],
      reset: 'yearly',
    })
    .returning()
  if (!created) throw new Error('series missing')
  return created
}

/** Raises the series counter so the next issued number follows the highest imported one. */
async function advanceCounter(
  tx: Tx,
  orgId: string,
  series: typeof numberSeries.$inferSelect,
  number: string,
  issueDate: string,
): Promise<boolean> {
  let parsed: ReturnType<typeof parseNumber> = null
  try {
    parsed = parseNumber(series.pattern, number)
  } catch {
    return false
  }
  if (!parsed) return false
  const date = {
    year: parsed.year ?? Number(issueDate.slice(0, 4)),
    month: parsed.month ?? Number(issueDate.slice(5, 7)),
  }
  await tx
    .insert(schema.numberSeriesCounter)
    .values({
      organizationId: orgId,
      seriesId: series.id,
      period: periodKey(series.reset, date),
      nextValue: parsed.counter + 1,
    })
    .onConflictDoUpdate({
      target: [schema.numberSeriesCounter.seriesId, schema.numberSeriesCounter.period],
      set: {
        nextValue: sql`greatest(${schema.numberSeriesCounter.nextValue}, ${parsed.counter + 1})`,
      },
    })
  return true
}

async function importDocument(
  tx: Tx,
  orgId: string,
  actorId: string,
  source: ImportSource,
  d: ImportDocument,
  contactIds: Map<string, string>,
  warnings: string[],
): Promise<{ adjusted: boolean }> {
  if (!d.number.trim()) throw new Error('Missing document number')
  if (!ISO_DATE.test(d.issueDate)) throw new Error('Missing or invalid issue date')
  if (d.lines.length === 0) throw new Error('Document has no lines')
  if (d.currency !== 'CZK' && !d.exchangeRate) throw new Error('Exchange rate is required')

  const [dupe] = await tx
    .select({ id: document.id })
    .from(document)
    .where(
      and(
        eq(document.organizationId, orgId),
        or(
          and(eq(document.type, d.type), eq(document.number, d.number)),
          d.externalId
            ? and(eq(document.importedFrom, source), eq(document.externalId, d.externalId))
            : undefined,
        ),
      ),
    )
  if (dupe) throw new SkipDocument('Already present (same source id or number)')

  const contactId =
    (d.customerExternalId ? contactIds.get(d.customerExternalId) : undefined) ??
    (await upsertContact(tx, orgId, d.customer)).id

  const vatPayer =
    d.type !== 'proforma' && !d.reverseCharge && d.lines.some((l) => parseDecimal(l.vatRate).gt(0))
  const totals = computeDocumentTotals(
    d.lines.map((l) => ({
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      vatRate: l.vatRate,
      discountPercent: l.discountPercent ?? '0',
    })),
    {
      vatPayer,
      currency: d.currency,
      exchangeRate: d.currency === 'CZK' ? 1 : (d.exchangeRate ?? 1),
    },
  )

  // Carry over the source system's rounding (< 1 Kč) so the total matches the original document.
  let total = totals.total
  let rounding = totals.rounding
  if (d.sourceTotal) {
    const diff = parseDecimal(d.sourceTotal).minus(totals.total)
    if (diff.abs().lt(1)) {
      total = d.sourceTotal
      rounding = toFixed(parseDecimal(totals.rounding).plus(diff), 2)
    } else {
      warnings.push(
        `Total ${totals.total} differs from the source total ${d.sourceTotal}; recomputed value kept`,
      )
    }
  }

  const payments = d.payments.map((p) => ({
    ...p,
    amount: p.amount === PAID_IN_FULL ? toFixed(total, 2) : p.amount,
  }))
  const paid = payments.reduce((sum, p) => sum.plus(parseDecimal(p.amount)), new Decimal(0))
  const fullyPaid = paid.gte(parseDecimal(total).minus('0.005')) && parseDecimal(total).gt(0)
  const status = d.cancelled ? 'cancelled' : fullyPaid ? 'paid' : 'issued'
  const lastPaid = payments.map((p) => p.paidOn).sort()[payments.length - 1]

  const [profile] = await tx
    .select()
    .from(businessProfile)
    .where(eq(businessProfile.organizationId, orgId))
  const [customer] = await tx
    .select()
    .from(contact)
    .where(and(eq(contact.organizationId, orgId), eq(contact.id, contactId)))
  const series = await defaultSeries(tx, orgId, d.type)

  const [row] = await tx
    .insert(document)
    .values({
      organizationId: orgId,
      type: d.type,
      number: d.number,
      seriesId: series.id,
      status,
      contactId,
      supplierSnapshot:
        d.supplier && d.supplier.name
          ? d.supplier
          : profile
            ? {
                name: profile.legalName,
                ico: profile.ico,
                dic: profile.dic,
                address: profile.address,
                vatStatus: profile.vatStatus,
              }
            : null,
      // Historical data from the source document, not the (possibly since-changed) contact row.
      customerSnapshot: {
        name: d.customer.name,
        ico: d.customer.ico ?? null,
        dic: d.customer.dic ?? null,
        icDph: d.customer.icDph ?? null,
        address: d.customer.address,
        country: d.customer.country,
        emails: d.customer.emails.length > 0 ? d.customer.emails : (customer?.emails ?? []),
        phone: d.customer.phone ?? null,
      },
      bankSnapshot: d.bank ? { ...d.bank, currency: d.currency } : null,
      issueDate: d.issueDate,
      taxableDate: d.taxableDate ?? d.issueDate,
      dueDate: d.dueDate,
      currency: d.currency,
      exchangeRate: d.currency === 'CZK' ? null : (d.exchangeRate ?? null),
      language: d.language,
      paymentMethod: d.paymentMethod,
      variableSymbol: d.variableSymbol ?? variableSymbolFromNumber(d.number),
      constantSymbol: d.constantSymbol ?? null,
      orderNumber: d.orderNumber ?? null,
      vatMode: d.reverseCharge
        ? 'reverse_charge'
        : d.oss && vatPayer
          ? 'oss'
          : vatPayer
            ? 'standard'
            : 'none',
      introText: d.introText ?? null,
      footerText: d.footerText ?? null,
      privateNote: d.privateNote ?? null,
      subtotal: totals.subtotal,
      vatTotal: totals.vatTotal,
      total,
      totalCzk:
        d.currency === 'CZK'
          ? total
          : total === totals.total
            ? totals.totalCzk
            : toFixed(parseDecimal(total).times(parseDecimal(d.exchangeRate ?? 1)), 2),
      rounding,
      importedFrom: source,
      externalId: d.externalId ?? null,
      publicToken: randomBytes(24).toString('base64url'),
      paidAt: status === 'paid' && lastPaid ? new Date(`${lastPaid}T12:00:00Z`) : null,
      cancelledAt: status === 'cancelled' ? new Date() : null,
    })
    .returning({ id: document.id })
  if (!row) throw new Error('document insert failed')

  await tx.insert(documentLine).values(
    d.lines.map((l, i) => ({
      organizationId: orgId,
      documentId: row.id,
      position: i,
      description: l.description.slice(0, 1000),
      quantity: l.quantity,
      unit: l.unit ?? null,
      unitPrice: l.unitPrice,
      vatRate: totals.lines[i]?.vatRate ?? '0',
      discountPercent: l.discountPercent ?? '0',
      lineSubtotal: totals.lines[i]?.base ?? '0',
      lineVat: totals.lines[i]?.vat ?? '0',
      lineTotal: totals.lines[i]?.total ?? '0',
    })),
  )
  if (payments.length > 0) {
    await tx.insert(payment).values(
      payments.map((p) => ({
        organizationId: orgId,
        documentId: row.id,
        paidOn: p.paidOn,
        amount: p.amount,
        currency: d.currency,
        method: d.paymentMethod,
        note: `Import (${source})`,
      })),
    )
  }
  await tx.insert(activity).values({
    organizationId: orgId,
    actorId,
    entityType: 'document',
    entityId: row.id,
    action: 'imported',
    data: { source, number: d.number },
  })

  const adjusted = await advanceCounter(tx, orgId, series, d.number, d.issueDate)
  return { adjusted }
}

export const importRepo = {
  /**
   * Imports contacts and documents in one transaction (documents each in a savepoint, so one bad
   * record never aborts the batch). Idempotent: already-imported records are skipped. With `dryRun`
   * everything is computed and then rolled back.
   */
  async run(
    db: Db,
    orgId: string,
    actorId: string,
    source: ImportSource,
    batch: ImportBatch,
    opts: { dryRun: boolean },
  ): Promise<ImportSummary> {
    const summary: ImportSummary = {
      dryRun: opts.dryRun,
      contacts: { created: 0, skipped: 0 },
      documents: { created: 0, skipped: 0, failed: 0 },
      numberingAdjusted: 0,
      issues: [],
    }
    const issue = (i: ImportIssue) => summary.issues.push(i)

    try {
      await db.transaction(async (tx) => {
        const contactIds = new Map<string, string>()
        for (const c of batch.contacts) {
          const { id, created } = await upsertContact(tx, orgId, c)
          if (c.externalId) contactIds.set(c.externalId, id)
          if (created) summary.contacts.created++
          else summary.contacts.skipped++
        }

        const touched = new Set<string>()
        for (const d of batch.documents) {
          const warnings: string[] = []
          try {
            const { adjusted } = await tx.transaction((sp) =>
              importDocument(sp, orgId, actorId, source, d, contactIds, warnings),
            )
            summary.documents.created++
            if (adjusted) touched.add(`${d.type}`)
            for (const w of warnings)
              issue({ kind: 'document', ref: d.number, level: 'warning', message: w })
          } catch (e) {
            if (e instanceof SkipDocument) {
              summary.documents.skipped++
              issue({ kind: 'document', ref: d.number, level: 'skipped', message: e.message })
            } else {
              summary.documents.failed++
              issue({
                kind: 'document',
                ref: d.number || '?',
                level: 'failed',
                message: e instanceof Error ? e.message : 'Unknown error',
              })
            }
          }
        }
        summary.numberingAdjusted = touched.size
        if (opts.dryRun) throw new Rollback()
      })
    } catch (e) {
      if (!(e instanceof Rollback)) throw e
    }
    return summary
  },
}
