import {
  computeDocumentTotals,
  czechAccountToIban,
  type DocumentLanguage,
  type ExportParty,
} from '@fakturky/domain'
import type { InvoicePdfInput, PdfLine } from './types.ts'

const BRAND_NAME = 'Fakturky'

const supplierSole: ExportParty = {
  name: 'Jan Novák',
  ico: '04817623',
  street: 'Vinohradská 1234/56',
  city: 'Praha 2',
  zip: '120 00',
  registerNote: 'Fyzická osoba zapsaná v živnostenském rejstříku vedeném ÚMČ Praha 2.',
  email: 'jan@novak.example',
  phone: '+420 602 123 456',
}

const supplierPayer: ExportParty = { ...supplierSole, dic: 'CZ7106151234' }

const customerCz: ExportParty = {
  name: 'Studio Lípa s.r.o.',
  ico: '27384915',
  dic: 'CZ27384915',
  street: 'Na Příkopě 22',
  city: 'Praha 1',
  zip: '110 00',
}

const customerDe: ExportParty = {
  name: 'Müller Digital GmbH',
  dic: 'DE811234567',
  street: 'Friedrichstraße 112',
  city: 'Berlin',
  zip: '10117',
  country: 'DE',
}

const bank = {
  accountNumber: '19-2000145399',
  bankCode: '0800',
  bankName: 'Česká spořitelna, a. s.',
  iban: czechAccountToIban('19-2000145399/0800'),
  bic: 'GIBACZPX',
}

function build(
  base: Omit<InvoicePdfInput, 'totals' | 'brandName' | 'currency'> & { currency?: string },
  roundTotal = false,
): InvoicePdfInput {
  const currency = base.currency ?? 'CZK'
  const totals = computeDocumentTotals(base.lines, {
    vatPayer: base.vatPayer,
    currency,
    ...(base.exchangeRate !== undefined ? { exchangeRate: base.exchangeRate } : {}),
    ...(base.pricesIncludeVat !== undefined ? { pricesIncludeVat: base.pricesIncludeVat } : {}),
    roundTotal,
  })
  return { ...base, currency, totals, brandName: BRAND_NAME }
}

/** (a) Neplátce, CZK, single line. */
export function nonPayerSingleLine(): InvoicePdfInput {
  return build({
    type: 'invoice',
    number: '2026012',
    uuid: '00000000-0000-4000-8000-000000000001',
    language: 'cs',
    issueDate: '2026-10-28',
    vatPayer: false,
    supplier: supplierSole,
    customer: { ...customerCz, dic: null },
    lines: [
      {
        description: 'Konzultace a vývoj webu',
        detail: 'Říjen 2026',
        quantity: '12.5',
        unit: 'h',
        unitPrice: '1200',
      },
    ],
    payment: {
      method: 'bank_transfer',
      dueDate: '2026-11-11',
      variableSymbol: '2026012',
      bankAccount: bank,
    },
    footerText: 'Děkuji za spolupráci.',
    issuedBy: 'Jan Novák',
  })
}

/** (b) Plátce, CZK, 21 % + 12 % lines. */
export function payerTwoRates(): InvoicePdfInput {
  return build({
    type: 'invoice',
    number: '2026058',
    uuid: '00000000-0000-4000-8000-000000000002',
    language: 'cs',
    issueDate: '2026-10-28',
    taxableDate: '2026-10-28',
    vatPayer: true,
    supplier: supplierPayer,
    customer: customerCz,
    lines: [
      {
        description: 'Návrh webu — UX, etapa 2',
        detail: 'Analýza uživatelů, drátěné modely 14 obrazovek',
        quantity: '24',
        unit: 'h',
        unitPrice: '1100',
        vatRate: '21',
      },
      {
        description: 'Grafický návrh vizuální identity',
        detail: 'Logo, barevnost, typografie, dvě kola revizí',
        quantity: '1',
        unit: 'ks',
        unitPrice: '18500',
        vatRate: '21',
      },
      {
        description: 'Hosting a správa domény',
        detail: 'studiolipa.cz · 11/2026 – 10/2027',
        quantity: '1',
        unit: 'ks',
        unitPrice: '3600',
        vatRate: '21',
      },
      {
        description: 'Tištěný brand manuál',
        detail: 'Formát A5, 48 stran, pevná vazba',
        quantity: '3',
        unit: 'ks',
        unitPrice: '1450',
        vatRate: '12',
      },
    ] satisfies PdfLine[],
    payment: {
      method: 'bank_transfer',
      dueDate: '2026-11-11',
      variableSymbol: '2026058',
      bankAccount: bank,
    },
    footerText: 'Děkuji za spolupráci.',
    note: 'Dle smlouvy o dílo č. SL-2026/04 ze dne 3. 9. 2026. Při úhradě prosím uveďte variabilní symbol.',
    issuedBy: 'Jan Novák',
  })
}

/** (c) Plátce, EUR, EU customer, reverse charge. */
export function euReverseCharge(): InvoicePdfInput {
  return build({
    type: 'invoice',
    number: '2026063',
    uuid: '00000000-0000-4000-8000-000000000003',
    language: 'cs',
    issueDate: '2026-10-30',
    taxableDate: '2026-10-30',
    vatPayer: true,
    supplier: supplierPayer,
    customer: customerDe,
    currency: 'EUR',
    exchangeRate: '25.215',
    lines: [
      {
        description: 'Softwarový vývoj — API integrace',
        detail: 'Říjen 2026',
        quantity: '40',
        unit: 'h',
        unitPrice: '65',
        vatTreatment: 'eu_reverse_charge',
      },
    ],
    payment: {
      method: 'bank_transfer',
      dueDate: '2026-11-29',
      variableSymbol: '2026063',
      bankAccount: { iban: 'LT603250012345678901', bic: 'REVOLT21', bankName: 'Revolut Bank UAB' },
    },
    issuedBy: 'Jan Novák',
  })
}

/** (d) 40 lines → multiple pages. */
export function manyLines(): InvoicePdfInput {
  const lines: PdfLine[] = Array.from({ length: 40 }, (_, i) => ({
    description: `Položka ${i + 1} — dodávka materiálu a práce`,
    detail: i % 3 === 0 ? 'Včetně dopravy a montáže na místě' : null,
    quantity: String(1 + (i % 5)),
    unit: 'ks',
    unitPrice: String(250 + i * 37),
    vatRate: i % 4 === 0 ? '12' : '21',
  }))
  return build(
    {
      type: 'invoice',
      number: '2026071',
      uuid: '00000000-0000-4000-8000-000000000004',
      language: 'cs',
      issueDate: '2026-10-31',
      taxableDate: '2026-10-31',
      vatPayer: true,
      supplier: supplierPayer,
      customer: customerCz,
      lines,
      payment: {
        method: 'bank_transfer',
        dueDate: '2026-11-14',
        variableSymbol: '2026071',
        bankAccount: bank,
      },
      issuedBy: 'Jan Novák',
    },
    true,
  )
}

/** (e) English, EUR, with rounding-free totals. */
export function english(): InvoicePdfInput {
  return build({
    type: 'invoice',
    number: '2026064',
    uuid: '00000000-0000-4000-8000-000000000005',
    language: 'en',
    issueDate: '2026-10-30',
    taxableDate: '2026-10-30',
    vatPayer: true,
    supplier: supplierPayer,
    customer: customerDe,
    currency: 'EUR',
    exchangeRate: '25.215',
    lines: [
      {
        description: 'Product design workshop',
        detail: 'Two-day on-site session',
        quantity: '2',
        unit: 'day',
        unitPrice: '900',
        vatTreatment: 'eu_reverse_charge',
      },
      {
        description: 'Prototype handover',
        quantity: '1',
        unit: 'pcs',
        unitPrice: '350',
        vatTreatment: 'eu_reverse_charge',
      },
    ],
    payment: {
      method: 'bank_transfer',
      dueDate: '2026-11-29',
      variableSymbol: '2026064',
      bankAccount: bank,
    },
    issuedBy: 'Jan Novák',
    footerText: 'Thank you for your business.',
  })
}

/** (f) Discount, advance, rounding, logo + signature slots (the images themselves are supplied by the caller). */
export function logoSignature(): InvoicePdfInput {
  const base = payerTwoRates()
  const lines = [{ ...(base.lines[0] as PdfLine), discountPercent: '10' }, ...base.lines.slice(1)]
  const totals = computeDocumentTotals(lines, { vatPayer: true, roundTotal: true })
  return { ...base, lines, totals, paidDeposits: '10000', note: null, showBrand: false }
}

export const ALL: Record<string, () => InvoicePdfInput> = {
  'a-neplatce-czk': nonPayerSingleLine,
  'b-platce-czk-21-12': payerTwoRates,
  'c-platce-eur-reverse-charge': euReverseCharge,
  'd-40-lines': manyLines,
  'e-english': english,
}

export type { DocumentLanguage }
