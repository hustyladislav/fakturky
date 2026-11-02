import {
  buildPaymentQrPayload,
  Decimal,
  generateIsdoc,
  parseDecimal,
  renderPaymentQr,
  todayPrague,
  toFixed,
  vatTreatmentText,
} from '@fakturky/domain'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { BRAND } from '../brand'
import { toDocumentForExport } from '../export'
import { publicProcedure } from '../orpc'
import { paymentQrInput } from '../payment-qr'
import { appearanceRepo } from '../repositories/appearance'
import { publicDocumentsRepo } from '../repositories/public-documents'

const party = z.object({
  name: z.string(),
  ico: z.string().nullable(),
  dic: z.string().nullable(),
  street: z.string(),
  city: z.string(),
  zip: z.string(),
  registerNote: z.string().nullable(),
})

/** Customer-facing view of an issued invoice. No private notes, no internal ids, no customer contact details. */
export const publicRouter = {
  invoice: publicProcedure
    .input(z.object({ token: z.string().min(20).max(200) }))
    .output(
      z.object({
        number: z.string(),
        type: z.string(),
        original: z.object({ number: z.string(), issueDate: z.string() }).nullable(),
        status: z.enum(['issued', 'paid', 'cancelled']),
        overdue: z.boolean(),
        issueDate: z.string(),
        dueDate: z.string(),
        taxableDate: z.string().nullable(),
        currency: z.string(),
        exchangeRate: z.string().nullable(),
        vatPayer: z.boolean(),
        supplier: party.extend({ email: z.string().nullable(), phone: z.string().nullable() }),
        customer: party,
        bank: z
          .object({
            iban: z.string(),
            bic: z.string().nullable(),
            account: z.string().nullable(),
          })
          .nullable(),
        variableSymbol: z.string().nullable(),
        paymentMethod: z.string(),
        qr: z
          .object({ kind: z.enum(['spayd', 'epc']), viewBox: z.number(), path: z.string() })
          .nullable(),
        lines: z.array(
          z.object({
            description: z.string(),
            quantity: z.string(),
            unit: z.string().nullable(),
            unitPrice: z.string(),
            vatRate: z.string(),
            discountPercent: z.string(),
            vatTreatment: z.string(),
            vatNote: z.string().nullable(),
            total: z.string(),
          }),
        ),
        recap: z.array(
          z.object({
            vatRate: z.string(),
            vatTreatment: z.string(),
            /** Legal text of the regime in the document language; empty for standard-rated lines. */
            note: z.string(),
            base: z.string(),
            vat: z.string(),
            total: z.string(),
          }),
        ),
        appearance: z.object({
          accentColor: z.string().nullable(),
          showBrand: z.boolean(),
          logo: z.string().nullable(),
          signature: z.string().nullable(),
        }),
        rounding: z.string(),
        subtotal: z.string(),
        vatTotal: z.string(),
        total: z.string(),
        remaining: z.string(),
        introText: z.string().nullable(),
        footerText: z.string().nullable(),
        /**
         * The document as the PDF sees it (the `InvoicePdfInput` shape of `@fakturky/pdf`), for the HTML twin.
         * Private note, customer contact details and internal ids are stripped; images are data URLs.
         */
        sheet: z.record(z.string(), z.unknown()),
      }),
    )
    .handler(async ({ context, input }) => {
      const found = await publicDocumentsRepo.getByToken(context.db, input.token)
      if (!found) throw new ORPCError('NOT_FOUND', { message: 'Document not found' })
      const { doc, lines } = found
      await publicDocumentsRepo.markViewed(context.db, doc)
      const x = toDocumentForExport(doc, lines, found.original)
      const look = await appearanceRepo.forDocument(context.db, doc.organizationId, doc.appearance)
      const paid = (await publicDocumentsRepo.paidAmount(context.db, doc)).reduce(
        (s, a) => s.plus(parseDecimal(a)),
        new Decimal(0),
      )
      const left = parseDecimal(doc.total).minus(paid)
      const today = todayPrague()
      const bank = x.payment?.bankAccount
      const p = (s: typeof x.supplier) => ({
        name: s.name,
        ico: s.ico ?? null,
        dic: s.dic ?? null,
        street: s.street,
        city: s.city,
        zip: s.zip,
        registerNote: s.registerNote ?? null,
      })
      return {
        number: x.number,
        type: x.type,
        original: found.original
          ? { number: found.original.number, issueDate: found.original.issueDate }
          : null,
        status: doc.status as 'issued' | 'paid' | 'cancelled',
        overdue: doc.status === 'issued' && !!doc.dueDate && doc.dueDate < today,
        issueDate: x.issueDate,
        dueDate: doc.dueDate ?? x.issueDate,
        taxableDate: x.taxableDate ?? null,
        currency: doc.currency,
        exchangeRate: doc.currency === 'CZK' ? null : doc.exchangeRate,
        vatPayer: x.vatPayer,
        supplier: {
          ...p(x.supplier),
          email: x.supplier.email ?? null,
          phone: x.supplier.phone ?? null,
        },
        customer: p(x.customer),
        bank: bank
          ? {
              iban: bank.iban,
              bic: bank.bic ?? null,
              account: bank.accountNumber ? `${bank.accountNumber}/${bank.bankCode}` : null,
            }
          : null,
        variableSymbol: doc.variableSymbol,
        paymentMethod: doc.paymentMethod,
        qr: await renderPaymentQr(paymentQrInput(doc, lines, paid)),
        lines: lines.map((l) => ({
          description: l.description,
          quantity: l.quantity,
          unit: l.unit,
          unitPrice: l.unitPrice,
          vatRate: l.vatRate,
          vatTreatment: l.vatTreatment,
          vatNote: l.vatNote,
          discountPercent: l.discountPercent,
          total: l.lineTotal,
        })),
        recap: x.totals.recap.map((r) => ({
          vatRate: r.vatRate,
          vatTreatment: r.vatTreatment,
          note: vatTreatmentText(r.vatTreatment, doc.language as 'cs' | 'sk' | 'en'),
          base: r.base,
          vat: r.vat,
          total: r.total,
        })),
        appearance: {
          accentColor: look.accentColor,
          showBrand: look.showBrand,
          logo: look.logo?.dataUrl ?? null,
          signature: look.signature?.dataUrl ?? null,
        },
        rounding: doc.rounding,
        subtotal: doc.subtotal,
        vatTotal: doc.vatTotal,
        total: doc.total,
        remaining:
          doc.status === 'issued' && left.isPositive()
            ? toFixed(left, 2)
            : toFixed(new Decimal(0), 2),
        introText: doc.introText,
        footerText: doc.footerText,
        sheet: {
          ...x,
          uuid: '',
          originalDocument: x.originalDocument ? { ...x.originalDocument, uuid: '' } : null,
          note: null,
          supplier: { ...x.supplier },
          customer: { ...x.customer, email: null, phone: null },
          lines: x.lines.map((l, i) => ({
            ...l,
            detail: lines[i]?.vatNote ? `${lines[i]?.vatNote}` : null,
            discountPercent: lines[i]?.discountPercent ?? '0',
          })),
          language: doc.language,
          brandName: BRAND.name,
          showBrand: look.showBrand,
          accentColor: look.accentColor ?? undefined,
          headerText: doc.introText,
          footerText: doc.footerText,
          logo: look.logo?.dataUrl ?? null,
          signature: look.signature?.dataUrl ?? null,
        },
      }
    }),

  isdoc: publicProcedure
    .input(z.object({ token: z.string().min(20).max(200) }))
    .output(z.object({ filename: z.string(), xml: z.string() }))
    .handler(async ({ context, input }) => {
      const found = await publicDocumentsRepo.getByToken(context.db, input.token)
      if (!found) throw new ORPCError('NOT_FOUND', { message: 'Document not found' })
      return {
        filename: `${found.doc.number ?? 'faktura'}.isdoc`,
        xml: generateIsdoc(toDocumentForExport(found.doc, found.lines, found.original)),
      }
    }),

  /** The payment QR as a PNG for the invoice e-mail (mail clients cannot show SVG or data: images). Not a "view". */
  qrPng: publicProcedure
    .input(z.object({ token: z.string().min(20).max(200) }))
    .output(z.object({ contentBase64: z.string() }))
    .handler(async ({ context, input }) => {
      const found = await publicDocumentsRepo.getByToken(context.db, input.token)
      if (!found) throw new ORPCError('NOT_FOUND', { message: 'Document not found' })
      const paid = (await publicDocumentsRepo.paidAmount(context.db, found.doc)).reduce(
        (s, a) => s.plus(parseDecimal(a)),
        new Decimal(0),
      )
      const qr = buildPaymentQrPayload(paymentQrInput(found.doc, found.lines, paid))
      if (!qr) throw new ORPCError('NOT_FOUND', { message: 'No payment QR for this document' })
      const { renderQrPng } = await import('@fakturky/domain/qr/png')
      return { contentBase64: Buffer.from(await renderQrPng(qr.payload)).toString('base64') }
    }),

  pdf: publicProcedure
    .input(z.object({ token: z.string().min(20).max(200) }))
    .output(z.object({ filename: z.string(), contentBase64: z.string() }))
    .handler(async ({ context, input }) => {
      const render = context.services?.renderPdf
      if (!render)
        throw new ORPCError('NOT_IMPLEMENTED', { message: 'PDF rendering is not available' })
      const found = await publicDocumentsRepo.getByToken(context.db, input.token)
      if (!found) throw new ORPCError('NOT_FOUND', { message: 'Document not found' })
      const bytes = await render(found.doc, found.lines, found.original)
      return {
        filename: `${found.doc.number ?? 'faktura'}.pdf`,
        contentBase64: Buffer.from(bytes).toString('base64'),
      }
    }),
}
