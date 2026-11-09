// Drafts: unnumbered, freely editable, deletable.
import { type Db, schema } from '@fakturky/db'
import { addDays, todayPrague, type VatTreatment } from '@fakturky/domain'
import { and, eq, isNull } from 'drizzle-orm'
import { bankAccountsRepo } from '../bank-accounts/repo'
import { DomainError } from '../errors'
import { assertVatLines, totalColumns, totalsFor, vatOn, writeLines } from './lines'
import { get } from './queries'
import type { DraftInput, DraftPatch } from './schema'
import { loadProfile, logActivity, scoped, type Tx } from './shared'

const { document, documentLine, businessProfile, contact, orgAsset } = schema

/** Freezes the document look (colour, brand line, logo/signature versions) at issue. */
async function appearanceSnapshot(db: Db | Tx, orgId: string) {
  const [p] = await db
    .select({ accentColor: businessProfile.accentColor, showBrand: businessProfile.showBrand })
    .from(businessProfile)
    .where(eq(businessProfile.organizationId, orgId))
  const assets = await db
    .select({ id: orgAsset.id, kind: orgAsset.kind })
    .from(orgAsset)
    .where(and(eq(orgAsset.organizationId, orgId), isNull(orgAsset.supersededAt)))
  return {
    accentColor: p?.accentColor ?? null,
    showBrand: p?.showBrand ?? true,
    logoAssetId: assets.find((a) => a.kind === 'logo')?.id ?? null,
    signatureAssetId: assets.find((a) => a.kind === 'signature')?.id ?? null,
  }
}

export async function createDraft(
  db: Db,
  orgId: string,
  actorId: string,
  input: DraftInput,
  opts: { relatedDocumentId?: string; pricesIncludeVat?: boolean } = {},
  via?: 'assistant',
) {
  if (input.type === 'payment_receipt' && !opts.relatedDocumentId) {
    throw new DomainError(
      'BAD_REQUEST',
      'Tax receipts are created from a paid proforma (createPaymentReceipt)',
    )
  }
  if (input.type === 'credit_note' && !opts.relatedDocumentId) {
    throw new DomainError(
      'BAD_REQUEST',
      'Credit notes are created from an invoice (createCreditNote)',
    )
  }
  const id = await db.transaction(async (tx) => {
    const profile = await loadProfile(tx, orgId)
    const issueDate = input.issueDate ?? todayPrague()
    let dueDays = profile?.defaultDueDays ?? 14
    if (input.contactId) {
      const [c] = await tx
        .select()
        .from(contact)
        .where(and(eq(contact.organizationId, orgId), eq(contact.id, input.contactId)))
      if (!c) throw new DomainError('NOT_FOUND', 'Contact not found')
      dueDays = c.defaultDueDays ?? dueDays
    }
    const currency = input.currency ?? profile?.defaultCurrency ?? 'CZK'
    const vatPayer = await vatOn(tx, orgId, profile, input.type, opts.relatedDocumentId)
    assertVatLines(input.lines, vatPayer)
    const paymentMethod = input.paymentMethod ?? profile?.defaultPaymentMethod ?? 'bank_transfer'
    // Whole-koruna rounding is the default for CZK cash payments (docs/DOMAIN.md); an explicit choice wins.
    const roundTotal = input.roundTotal ?? (currency === 'CZK' && paymentMethod === 'cash')
    const totals = totalsFor(input.lines, {
      vatPayer,
      roundTotal,
      pricesIncludeVat: opts.pricesIncludeVat,
      currency,
      exchangeRate: input.exchangeRate,
    })
    const bank = input.bankAccountId
      ? await bankAccountsRepo.get(tx, orgId, input.bankAccountId)
      : await bankAccountsRepo.defaultFor(tx, orgId, currency)
    if (input.bankAccountId && !bank) throw new DomainError('NOT_FOUND', 'Bank account not found')
    const [row] = await tx
      .insert(document)
      .values({
        organizationId: orgId,
        type: input.type,
        roundTotal,
        pricesIncludeVat: opts.pricesIncludeVat ?? false,
        relatedDocumentId: opts.relatedDocumentId ?? null,
        contactId: input.contactId ?? null,
        bankAccountId: bank?.id ?? null,
        appearance: await appearanceSnapshot(tx, orgId),
        issueDate,
        taxableDate: input.taxableDate ?? issueDate,
        dueDate: input.dueDate ?? addDays(issueDate, dueDays),
        currency,
        exchangeRate: input.exchangeRate ?? null,
        language: input.language ?? profile?.defaultLanguage ?? 'cs',
        paymentMethod: input.paymentMethod ?? profile?.defaultPaymentMethod ?? 'bank_transfer',
        constantSymbol: input.constantSymbol ?? null,
        orderNumber: input.orderNumber ?? null,
        introText: input.introText ?? null,
        footerText: input.footerText ?? profile?.defaultFooter ?? null,
        privateNote: input.privateNote ?? null,
        vatMode: vatPayer ? 'standard' : 'none',
        ...totalColumns(totals, currency),
      })
      .returning({ id: document.id })
    if (!row) throw new Error('insert returned no row')
    await writeLines(tx, orgId, row.id, input.lines, totals, vatPayer)
    await logActivity(tx, orgId, actorId, row.id, 'created', via ? { via } : undefined)
    return row.id
  })
  return get(db, orgId, id)
}

export async function updateDraft(
  db: Db,
  orgId: string,
  actorId: string,
  id: string,
  patch: DraftPatch,
) {
  await db.transaction(async (tx) => {
    const [doc] = await tx.select().from(document).where(scoped(orgId, id)).for('update')
    if (!doc) throw new DomainError('NOT_FOUND', 'Document not found')
    if (doc.status !== 'draft') {
      throw new DomainError('CONFLICT', 'Only drafts can be edited; issued documents are immutable')
    }
    const { lines, ...rest } = patch
    if (rest.contactId) {
      const [c] = await tx
        .select({ id: contact.id })
        .from(contact)
        .where(and(eq(contact.organizationId, orgId), eq(contact.id, rest.contactId)))
      if (!c) throw new DomainError('NOT_FOUND', 'Contact not found')
    }
    if (rest.bankAccountId && !(await bankAccountsRepo.get(tx, orgId, rest.bankAccountId))) {
      throw new DomainError('NOT_FOUND', 'Bank account not found')
    }
    const profile = await loadProfile(tx, orgId)
    const currency = rest.currency ?? doc.currency
    const exchangeRate = rest.exchangeRate === undefined ? doc.exchangeRate : rest.exchangeRate
    const existingLines = lines
      ? null
      : await tx
          .select()
          .from(documentLine)
          .where(and(eq(documentLine.organizationId, orgId), eq(documentLine.documentId, id)))
    const effective = (lines ?? existingLines ?? []) as DraftInput['lines']
    const vatForDraft = await vatOn(tx, orgId, profile, doc.type, doc.relatedDocumentId)
    assertVatLines(effective, vatForDraft)
    const roundTotal = rest.roundTotal ?? doc.roundTotal
    const totals = totalsFor(effective, {
      vatPayer: vatForDraft,
      roundTotal,
      pricesIncludeVat: doc.pricesIncludeVat,
      currency,
      exchangeRate,
    })
    await tx
      .update(document)
      .set({
        ...rest,
        currency,
        exchangeRate,
        vatMode: vatForDraft ? 'standard' : 'none',
        ...totalColumns(totals, currency),
      })
      .where(scoped(orgId, id))
    if (lines) await writeLines(tx, orgId, id, lines, totals, vatForDraft)
    await logActivity(tx, orgId, actorId, id, 'updated')
  })
  return get(db, orgId, id)
}

export async function duplicate(db: Db, orgId: string, actorId: string, id: string) {
  const src = await get(db, orgId, id)
  if (!src) throw new DomainError('NOT_FOUND', 'Document not found')
  if (src.type === 'credit_note') {
    throw new DomainError('CONFLICT', 'Credit notes cannot be duplicated')
  }
  return createDraft(db, orgId, actorId, {
    type: src.type as 'invoice' | 'proforma' | 'credit_note',
    contactId: src.contactId,
    bankAccountId: src.bankAccountId,
    currency: src.currency,
    exchangeRate: src.exchangeRate,
    roundTotal: src.roundTotal,
    language: src.language as 'cs' | 'sk' | 'en',
    paymentMethod: src.paymentMethod,
    constantSymbol: src.constantSymbol,
    orderNumber: src.orderNumber,
    introText: src.introText,
    footerText: src.footerText,
    privateNote: src.privateNote,
    lines: src.lines.map((l) => ({
      description: l.description,
      quantity: l.quantity,
      unit: l.unit,
      unitPrice: l.unitPrice,
      vatRate: l.vatRate,
      vatTreatment: l.vatTreatment as VatTreatment,
      vatNote: l.vatNote,
      discountPercent: l.discountPercent,
    })),
  })
}

/** Drafts only: issued numbers are never reused, so issued documents are cancelled instead. */
export async function deleteDraft(db: Db, orgId: string, actorId: string, id: string) {
  return db.transaction(async (tx) => {
    const [doc] = await tx.select().from(document).where(scoped(orgId, id)).for('update')
    if (!doc) throw new DomainError('NOT_FOUND', 'Document not found')
    if (doc.status !== 'draft') {
      throw new DomainError(
        'CONFLICT',
        'Only drafts can be deleted; cancel issued documents instead',
      )
    }
    await tx.update(document).set({ deletedAt: new Date() }).where(scoped(orgId, id))
    await logActivity(tx, orgId, actorId, id, 'deleted')
    return { id }
  })
}
