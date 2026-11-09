import type { Db } from '@fakturky/db'
import { schema } from '@fakturky/db'
import { computeDocumentTotals, type VatReportDocument, type VatTreatment } from '@fakturky/domain'
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm'

const { document, documentLine, businessProfile } = schema

/** What the report shows about a contributing document (drill-down). */
export interface VatDocumentInfo {
  id: string
  number: string
  type: 'invoice' | 'credit_note' | 'payment_receipt'
  taxableDate: string
  customerName: string
  currency: string
  totalCzk: string
}

const TAX_TYPES = ['invoice', 'credit_note', 'payment_receipt'] as const

/** DUZP, falling back to the issue date (older imports may lack it). */
const taxDate = sql<string>`coalesce(${document.taxableDate}, ${document.issueDate})`

export const vatRepo = {
  async profile(db: Db, orgId: string) {
    const [row] = await db
      .select()
      .from(businessProfile)
      .where(eq(businessProfile.organizationId, orgId))
    return row ?? null
  },

  /**
   * Issued tax documents of the organization whose DUZP lies in [from, to], with VAT recap converted to CZK.
   * Drafts, cancelled documents, proformas and documents issued while the organization was not a VAT payer
   * (`vat_mode = none`) are left out. Everything is scoped by `orgId`.
   */
  async documentsForRange(
    db: Db,
    orgId: string,
    range: { from: string; to: string },
  ): Promise<{ documents: VatReportDocument[]; info: Record<string, VatDocumentInfo> }> {
    const docs = await db
      .select()
      .from(document)
      .where(
        and(
          eq(document.organizationId, orgId),
          isNull(document.deletedAt),
          inArray(document.type, [...TAX_TYPES]),
          inArray(document.status, ['issued', 'paid']),
          sql`${document.vatMode} <> 'none'`,
          sql`${taxDate} >= ${range.from}`,
          sql`${taxDate} <= ${range.to}`,
        ),
      )
      .orderBy(asc(taxDate), asc(document.number))
    if (docs.length === 0) return { documents: [], info: {} }

    const lines = await db
      .select()
      .from(documentLine)
      .where(
        and(
          eq(documentLine.organizationId, orgId),
          inArray(
            documentLine.documentId,
            docs.map((d) => d.id),
          ),
        ),
      )
      .orderBy(asc(documentLine.position))
    const byDoc = new Map<string, typeof lines>()
    for (const l of lines) byDoc.set(l.documentId, [...(byDoc.get(l.documentId) ?? []), l])

    const documents: VatReportDocument[] = []
    const info: Record<string, VatDocumentInfo> = {}
    for (const d of docs) {
      const isCzk = d.currency.toUpperCase() === 'CZK'
      const rate = d.exchangeRate && Number(d.exchangeRate) > 0 ? d.exchangeRate : null
      const totals = computeDocumentTotals(
        (byDoc.get(d.id) ?? []).map((l) => ({
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          vatRate: l.vatRate,
          vatTreatment: l.vatTreatment as VatTreatment,
          discountPercent: l.discountPercent,
        })),
        {
          vatPayer: true,
          pricesIncludeVat: d.pricesIncludeVat,
          currency: d.currency,
          exchangeRate: isCzk ? 1 : (rate ?? 1),
        },
      )
      const customer = d.customerSnapshot ?? {}
      const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
      const customerName = str(customer.name) ?? '—'
      const number = d.number ?? d.id
      const date = (d.taxableDate ?? d.issueDate) as string
      documents.push({
        id: d.id,
        type: d.type as VatReportDocument['type'],
        number,
        taxableDate: date,
        customer: {
          name: customerName,
          country: str(customer.country),
          dic: str(customer.dic),
          icDph: str(customer.icDph),
        },
        recap: totals.recap.map((r) => ({
          vatRate: r.vatRate,
          vatTreatment: r.vatTreatment,
          baseCzk: r.baseCzk ?? r.base,
          vatCzk: r.vatCzk ?? r.vat,
        })),
        ...(!isCzk && !rate ? { missingExchangeRate: true } : {}),
      })
      info[d.id] = {
        id: d.id,
        number,
        type: d.type as VatDocumentInfo['type'],
        taxableDate: date,
        customerName,
        currency: d.currency,
        totalCzk: totals.totalCzk,
      }
    }
    return { documents, info }
  },
}
