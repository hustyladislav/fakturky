// How a draft's lines become stored totals: whether VAT applies, validation, computation, persistence.
import { type Db, schema } from '@fakturky/db'
import { computeDocumentTotals, VAT_RATES, type VatTreatment } from '@fakturky/domain'
import { and, eq } from 'drizzle-orm'
import { DomainError } from '../errors'
import type { DraftInput } from './schema'
import type { Tx } from './shared'

const { document, documentLine } = schema

/** VAT applies only to tax documents issued by a VAT payer; proformas never carry VAT. */
export const vatApplies = (profile: { vatStatus: string } | null, type: string) =>
  profile?.vatStatus === 'payer' &&
  (type === 'invoice' || type === 'credit_note' || type === 'payment_receipt')

/**
 * Whether VAT is computed. A credit note follows the VAT treatment of the invoice it corrects (the
 * supplier's status may have changed since), everything else follows the current profile.
 */
export async function vatOn(
  db: Db | Tx,
  orgId: string,
  profile: { vatStatus: string } | null,
  type: string,
  relatedId: string | null | undefined,
) {
  if (type !== 'credit_note') return vatApplies(profile, type)
  if (!relatedId) return false
  const [o] = await db
    .select({ vatMode: document.vatMode })
    .from(document)
    .where(and(eq(document.organizationId, orgId), eq(document.id, relatedId)))
  return !!o && o.vatMode !== 'none'
}

/** A VAT payer's standard-rated line needs a real rate (there is no 0 % in Czech VAT: use a regime). */
export function assertVatLines(
  lines: Array<{ vatRate: string; vatTreatment?: string }>,
  vatPayer: boolean,
) {
  if (!vatPayer) return
  const bad = lines.find(
    (l) =>
      (l.vatTreatment ?? 'standard') === 'standard' &&
      !(VAT_RATES.CZ as readonly string[]).includes(String(Number(l.vatRate))),
  )
  if (bad) {
    throw new DomainError(
      'BAD_REQUEST',
      'Use a VAT rate of 21 or 12, or choose a VAT regime (exempt, reverse charge, …) for the line',
      ['line.vatRate'],
    )
  }
}

export function totalsFor(
  lines: DraftInput['lines'],
  opts: {
    vatPayer: boolean
    currency: string
    exchangeRate?: string | null
    roundTotal?: boolean
    pricesIncludeVat?: boolean
  },
) {
  return computeDocumentTotals(
    lines.map((l) => ({
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      vatRate: l.vatRate,
      vatTreatment: l.vatTreatment as VatTreatment | undefined,
      discountPercent: l.discountPercent,
    })),
    {
      vatPayer: opts.vatPayer,
      roundTotal: opts.roundTotal ?? false,
      pricesIncludeVat: opts.pricesIncludeVat ?? false,
      currency: opts.currency,
      exchangeRate: opts.currency === 'CZK' ? 1 : (opts.exchangeRate ?? 1),
    },
  )
}

export async function writeLines(
  tx: Tx,
  orgId: string,
  documentId: string,
  lines: DraftInput['lines'],
  totals: ReturnType<typeof computeDocumentTotals>,
  vatOn: boolean,
) {
  await tx
    .delete(documentLine)
    .where(and(eq(documentLine.organizationId, orgId), eq(documentLine.documentId, documentId)))
  if (lines.length === 0) return
  await tx.insert(documentLine).values(
    lines.map((l, i) => ({
      organizationId: orgId,
      documentId,
      position: i,
      description: l.description,
      quantity: l.quantity,
      unit: l.unit ?? null,
      unitPrice: l.unitPrice,
      vatRate: totals.lines[i]?.vatRate ?? '0',
      vatTreatment: vatOn ? (totals.lines[i]?.vatTreatment ?? 'standard') : 'standard',
      vatNote:
        vatOn && totals.lines[i]?.vatTreatment === 'exempt' ? l.vatNote?.trim() || null : null,
      discountPercent: l.discountPercent,
      lineSubtotal: totals.lines[i]?.base ?? '0',
      lineVat: totals.lines[i]?.vat ?? '0',
      lineTotal: totals.lines[i]?.total ?? '0',
    })),
  )
}

export function totalColumns(totals: ReturnType<typeof computeDocumentTotals>, currency: string) {
  return {
    subtotal: totals.subtotal,
    vatTotal: totals.vatTotal,
    total: totals.total,
    totalCzk: currency === 'CZK' ? totals.total : totals.totalCzk,
    rounding: totals.rounding,
  }
}
