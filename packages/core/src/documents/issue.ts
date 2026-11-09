// Issuing: the one transaction that numbers a draft and freezes its snapshots.
import { randomBytes } from 'node:crypto'
import { type Db, schema } from '@fakturky/db'
import {
  DEFAULT_NUMBER_PATTERNS,
  Decimal,
  formatDocumentNumber,
  parseDecimal,
  periodKey,
  todayPrague,
  toFixed,
  variableSymbolFromNumber,
} from '@fakturky/domain'
import { and, asc, eq, inArray, isNull, ne, sql } from 'drizzle-orm'
import { bankAccountsRepo } from '../bank-accounts/repo'
import { DomainError } from '../errors'
import { assertVatLines, totalColumns, totalsFor, vatOn, writeLines } from './lines'
import { get } from './queries'
import type { DraftInput } from './schema'
import { loadProfile, logActivity, scoped } from './shared'
import { CREDIT_NOTE_METHOD, paidSums } from './status'

const { document, documentLine, payment, contact, numberSeries } = schema

const SERIES_NAMES: Record<string, string> = {
  invoice: 'Faktury',
  proforma: 'Zálohové faktury',
  credit_note: 'Opravné doklady',
  payment_receipt: 'Doklady k přijaté platbě',
}

export async function issue(db: Db, orgId: string, actorId: string, id: string) {
  await db.transaction(async (tx) => {
    const [doc] = await tx.select().from(document).where(scoped(orgId, id)).for('update')
    if (!doc) throw new DomainError('NOT_FOUND', 'Document not found')
    if (doc.status !== 'draft') throw new DomainError('CONFLICT', 'Document is already issued')
    const profile = await loadProfile(tx, orgId)
    if (!profile) {
      throw new DomainError('PRECONDITION_FAILED', 'Fill in your business profile before issuing')
    }
    if (!doc.contactId) throw new DomainError('PRECONDITION_FAILED', 'Choose a customer first')
    const lines = await tx
      .select()
      .from(documentLine)
      .where(and(eq(documentLine.organizationId, orgId), eq(documentLine.documentId, id)))
    if (lines.length === 0) throw new DomainError('PRECONDITION_FAILED', 'Add at least one line')
    if (doc.currency !== 'CZK' && !doc.exchangeRate) {
      throw new DomainError('PRECONDITION_FAILED', 'Exchange rate is required for foreign currency')
    }
    const vatOnNow = await vatOn(tx, orgId, profile, doc.type, doc.relatedDocumentId)
    const [customer] = await tx
      .select()
      .from(contact)
      .where(and(eq(contact.organizationId, orgId), eq(contact.id, doc.contactId)))
    if (!customer) throw new DomainError('NOT_FOUND', 'Contact not found')
    // §29 ZDPH: a tax document needs the customer's name and address; the DIČ only if the customer is registered
    // (a consumer has none), so a missing IČO/DIČ must not block issuing.
    if (vatOnNow) {
      const exempt = lines.filter((l) => l.vatTreatment === 'exempt')
      if (exempt.some((l) => !l.vatNote?.trim())) {
        throw new DomainError(
          'PRECONDITION_FAILED',
          'Exempt lines need the statutory basis (§ of the VAT act)',
          ['line.vatNote'],
        )
      }
      const missing: string[] = []
      if (
        !customer.address.street?.trim() ||
        !customer.address.city?.trim() ||
        !customer.address.zip?.trim()
      ) {
        missing.push('address')
      }
      // EU reverse charge needs the customer's VAT ID (IČ DPH / DIČ), not just an IČO.
      if (
        lines.some((l) => l.vatTreatment === 'eu_reverse_charge') &&
        !customer.icDph?.trim() &&
        !customer.dic?.trim()
      ) {
        missing.push('vatId')
      }
      // The EU reverse charge applies to supplies to another member state, not to a domestic customer.
      if (
        lines.some((l) => l.vatTreatment === 'eu_reverse_charge') &&
        (customer.country ?? 'CZ').toUpperCase() === 'CZ'
      ) {
        missing.push('country')
      }
      if (missing.length > 0) {
        throw new DomainError(
          'PRECONDITION_FAILED',
          `The customer is missing: ${missing.join(', ')}`,
          missing.map((f) => `customer.${f}`),
        )
      }
    }
    const bank = doc.bankAccountId
      ? await bankAccountsRepo.get(tx, orgId, doc.bankAccountId)
      : await bankAccountsRepo.defaultFor(tx, orgId, doc.currency)

    // Totals are recomputed under the VAT status being snapshotted (it may have changed since the draft).
    if (doc.type === 'credit_note' && (!doc.relatedDocumentId || !doc.introText?.trim())) {
      throw new DomainError(
        'PRECONDITION_FAILED',
        'A credit note needs the corrected invoice and a reason',
      )
    }
    const totals = totalsFor(lines as unknown as DraftInput['lines'], {
      vatPayer: vatOnNow,
      roundTotal: doc.roundTotal,
      pricesIncludeVat: doc.pricesIncludeVat,
      currency: doc.currency,
      exchangeRate: doc.exchangeRate,
    })
    assertVatLines(lines as unknown as DraftInput['lines'], vatOnNow)
    if (doc.type === 'credit_note' && doc.relatedDocumentId) {
      // Corrections may be partial and repeated, but together they cannot refund more than the invoice.
      const originalId = doc.relatedDocumentId
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`credit:${originalId}`}))`)
      const [orig] = await tx
        .select({ total: document.total })
        .from(document)
        .where(scoped(orgId, originalId))
      const others = await tx
        .select({ total: document.total })
        .from(document)
        .where(
          and(
            eq(document.organizationId, orgId),
            eq(document.relatedDocumentId, originalId),
            eq(document.type, 'credit_note'),
            inArray(document.status, ['issued', 'paid']),
            isNull(document.deletedAt),
            ne(document.id, id),
          ),
        )
      const credited = others.reduce(
        (sum, o) => sum.plus(parseDecimal(o.total)),
        parseDecimal(totals.total),
      )
      if (orig && credited.abs().greaterThan(parseDecimal(orig.total).abs())) {
        throw new DomainError(
          'CONFLICT',
          'The credit notes would refund more than the invoice total',
        )
      }
    }
    await writeLines(tx, orgId, id, lines as unknown as DraftInput['lines'], totals, vatOnNow)

    // Number allocation: lazily created default series + atomic counter bump.
    // Serialize per (org, type) so concurrent first issues cannot create two default series.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`${orgId}:${doc.type}`}))`)
    let [series] = await tx
      .select()
      .from(numberSeries)
      .where(
        and(
          eq(numberSeries.organizationId, orgId),
          eq(numberSeries.documentType, doc.type),
          eq(numberSeries.isDefault, true),
        ),
      )
      .orderBy(asc(numberSeries.createdAt))
    if (!series) {
      const pattern = DEFAULT_NUMBER_PATTERNS[doc.type as keyof typeof DEFAULT_NUMBER_PATTERNS]
      ;[series] = await tx
        .insert(numberSeries)
        .values({
          organizationId: orgId,
          documentType: doc.type,
          name: SERIES_NAMES[doc.type] ?? doc.type,
          pattern,
          reset: 'yearly',
        })
        .returning()
    }
    if (!series) throw new Error('series missing')
    const issueDate = doc.issueDate ?? todayPrague()
    const date = { year: Number(issueDate.slice(0, 4)), month: Number(issueDate.slice(5, 7)) }
    const period = periodKey(series.reset, date)
    const [counter] = await tx
      .insert(schema.numberSeriesCounter)
      .values({ organizationId: orgId, seriesId: series.id, period, nextValue: 2 })
      .onConflictDoUpdate({
        target: [schema.numberSeriesCounter.seriesId, schema.numberSeriesCounter.period],
        set: { nextValue: sql`${schema.numberSeriesCounter.nextValue} + 1` },
      })
      .returning({ nextValue: schema.numberSeriesCounter.nextValue })
    if (!counter) throw new Error('counter missing')
    const number = formatDocumentNumber(series.pattern, counter.nextValue - 1, date)

    await tx
      .update(document)
      .set({
        status: 'issued',
        vatMode: vatOnNow ? 'standard' : 'none',
        ...totalColumns(totals, doc.currency),
        number,
        seriesId: series.id,
        variableSymbol: variableSymbolFromNumber(number, doc.type),
        bankAccountId: bank?.id ?? null,
        issueDate,
        publicToken: randomBytes(24).toString('base64url'),
        supplierSnapshot: {
          name: profile.legalName,
          ico: profile.ico,
          dic: profile.dic,
          address: profile.address,
          vatStatus: profile.vatStatus,
          registryNote: profile.registryNote,
          email: profile.email,
          phone: profile.phone,
          website: profile.website,
        },
        customerSnapshot: {
          name: customer.name,
          ico: customer.ico,
          dic: customer.dic,
          icDph: customer.icDph,
          address: customer.address,
          country: customer.country,
          emails: customer.emails,
          phone: customer.phone,
        },
        bankSnapshot: bank
          ? {
              label: bank.label,
              currency: bank.currency,
              iban: bank.iban,
              accountNumber: bank.accountNumber,
              bankCode: bank.bankCode,
              bic: bank.bic,
              showQr: bank.showQr,
            }
          : null,
      })
      .where(scoped(orgId, id))
    // A final invoice fully covered by the advance is settled on issue.
    // A tax receipt documents a payment already received, so it is settled on issue.
    if (
      doc.type === 'payment_receipt' ||
      (doc.type === 'invoice' && doc.relatedDocumentId && parseDecimal(totals.total).lte(0))
    ) {
      await tx.update(document).set({ status: 'paid', paidAt: new Date() }).where(scoped(orgId, id))
    }
    // A credit note settles the corrected invoice's open balance (never beyond it: a refund of money
    // already received is a separate payment out).
    if (doc.type === 'credit_note' && doc.relatedDocumentId) {
      const [orig] = await tx
        .select()
        .from(document)
        .where(scoped(orgId, doc.relatedDocumentId))
        .for('update')
      if (orig && orig.status === 'issued') {
        const open = parseDecimal(orig.total).minus(
          (await paidSums(tx, orgId, [orig.id])).get(orig.id) ?? new Decimal(0),
        )
        const creditTotal = parseDecimal(totals.total).abs()
        const credit = creditTotal.lt(open) ? creditTotal : open
        if (credit.gt(0)) {
          await tx.insert(payment).values({
            organizationId: orgId,
            documentId: orig.id,
            paidOn: doc.issueDate ?? todayPrague(),
            amount: toFixed(credit, 2),
            currency: orig.currency,
            method: CREDIT_NOTE_METHOD,
            note: number,
          })
          if (credit.gte(open)) {
            await tx
              .update(document)
              .set({ status: 'paid', paidAt: new Date() })
              .where(scoped(orgId, orig.id))
          }
        }
      }
    }
    await logActivity(tx, orgId, actorId, id, 'issued', { number })
  })
  return get(db, orgId, id)
}
