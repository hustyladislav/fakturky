import type { DocumentLanguage } from '@fakturky/domain'

export interface Labels {
  invoice: string
  invoiceTax: string
  proforma: string
  creditNote: string
  creditNoteTax: string
  paymentReceipt: string
  numberPrefix: string
  supplier: string
  customer: string
  ico: string
  dic: string
  vatPayer: string
  nonVatPayer: string
  issueDate: string
  taxableDate: string
  dueDate: string
  paymentMethod: string
  methods: Record<string, string>
  paymentDetails: string
  bank: string
  accountNumber: string
  iban: string
  bic: string
  variableSymbol: string
  constantSymbol: string
  specificSymbol: string
  amountDue: string
  qrSpayd: string
  qrEpc: string
  description: string
  quantity: string
  unit: string
  unitPrice: string
  vatRate: string
  lineTotal: string
  lineTotalExVat: string
  lineTotalIncVat: string
  discount: string
  vatRecap: string
  rate: string
  base: string
  vat: string
  total: string
  sum: string
  recapCzk: string
  exchangeRate: string
  subtotal: string
  rounding: string
  deposits: string
  remaining: string
  issuedBy: string
  page: string
  issuedIn: string
  notTaxDocument: string
  corrects: string
  correctionReason: string
  customerVatId: string
  note: string
  taxNote: string
  taxableDateDefault: string
}

export const LABELS: Record<DocumentLanguage, Labels> = {
  cs: {
    invoice: 'Faktura',
    invoiceTax: 'Faktura – daňový doklad',
    proforma: 'Zálohová faktura',
    creditNote: 'Opravný doklad',
    creditNoteTax: 'Opravný daňový doklad',
    paymentReceipt: 'Daňový doklad k přijaté platbě',
    numberPrefix: 'č.',
    supplier: 'Dodavatel',
    customer: 'Odběratel',
    ico: 'IČO',
    dic: 'DIČ',
    vatPayer: 'Plátce DPH',
    nonVatPayer: 'Neplátce DPH',
    issueDate: 'Datum vystavení',
    taxableDate: 'Datum uskutečnění zdanitelného plnění',
    dueDate: 'Datum splatnosti',
    paymentMethod: 'Forma úhrady',
    methods: {
      bank_transfer: 'Převodem',
      cash: 'Hotově',
      card: 'Kartou',
      cash_on_delivery: 'Dobírkou',
      other: 'Jiná',
    },
    paymentDetails: 'Platební údaje',
    bank: 'Banka',
    accountNumber: 'Číslo účtu',
    iban: 'IBAN',
    bic: 'BIC',
    variableSymbol: 'Variabilní symbol',
    constantSymbol: 'Konstantní symbol',
    specificSymbol: 'Specifický symbol',
    amountDue: 'K úhradě',
    qrSpayd: 'QR Platba',
    qrEpc: 'SEPA QR',
    description: 'Popis',
    quantity: 'Množství',
    unit: 'MJ',
    unitPrice: 'Cena za MJ',
    vatRate: 'DPH',
    lineTotal: 'Celkem',
    lineTotalExVat: 'Celkem bez DPH',
    lineTotalIncVat: 'Celkem s DPH',
    discount: 'Sleva',
    vatRecap: 'Rekapitulace DPH',
    rate: 'Sazba',
    base: 'Základ',
    vat: 'DPH',
    total: 'Celkem',
    sum: 'Součet',
    recapCzk: 'Přepočet DPH na Kč',
    exchangeRate: 'Kurz',
    subtotal: 'Mezisoučet',
    rounding: 'Zaokrouhlení',
    deposits: 'Uhrazené zálohy',
    remaining: 'Zbývá uhradit',
    issuedBy: 'Vystavil(a)',
    page: 'Strana',
    issuedIn: 'Vystaveno ve',
    notTaxDocument: 'Tento doklad není daňovým dokladem.',
    corrects: 'Opravuje doklad č. {number} ze dne {date}.',
    correctionReason: 'Důvod opravy',
    customerVatId: 'DIČ odběratele',
    note: 'Poznámka',
    taxNote: 'Poznámka k DPH',
    taxableDateDefault: 'DUZP',
  },
  sk: {
    invoice: 'Faktúra',
    invoiceTax: 'Faktúra – daňový doklad',
    proforma: 'Zálohová faktúra',
    creditNote: 'Opravný doklad',
    creditNoteTax: 'Opravný daňový doklad',
    paymentReceipt: 'Daňový doklad k prijatej platbe',
    numberPrefix: 'č.',
    supplier: 'Dodávateľ',
    customer: 'Odberateľ',
    ico: 'IČO',
    dic: 'DIČ',
    vatPayer: 'Platiteľ DPH',
    nonVatPayer: 'Neplatiteľ DPH',
    issueDate: 'Dátum vystavenia',
    taxableDate: 'Dátum dodania',
    dueDate: 'Dátum splatnosti',
    paymentMethod: 'Forma úhrady',
    methods: {
      bank_transfer: 'Prevodom',
      cash: 'Hotovosť',
      card: 'Kartou',
      cash_on_delivery: 'Dobierka',
      other: 'Iná',
    },
    paymentDetails: 'Platobné údaje',
    bank: 'Banka',
    accountNumber: 'Číslo účtu',
    iban: 'IBAN',
    bic: 'BIC',
    variableSymbol: 'Variabilný symbol',
    constantSymbol: 'Konštantný symbol',
    specificSymbol: 'Špecifický symbol',
    amountDue: 'Na úhradu',
    qrSpayd: 'QR platba',
    qrEpc: 'SEPA QR',
    description: 'Popis',
    quantity: 'Množstvo',
    unit: 'MJ',
    unitPrice: 'Cena za MJ',
    vatRate: 'DPH',
    lineTotal: 'Spolu',
    lineTotalExVat: 'Spolu bez DPH',
    lineTotalIncVat: 'Spolu s DPH',
    discount: 'Zľava',
    vatRecap: 'Rekapitulácia DPH',
    rate: 'Sadzba',
    base: 'Základ',
    vat: 'DPH',
    total: 'Spolu',
    sum: 'Súčet',
    recapCzk: 'Prepočet DPH na Kč',
    exchangeRate: 'Kurz',
    subtotal: 'Medzisúčet',
    rounding: 'Zaokrúhlenie',
    deposits: 'Uhradené zálohy',
    remaining: 'Zostáva uhradiť',
    issuedBy: 'Vystavil(a)',
    page: 'Strana',
    issuedIn: 'Vystavené vo',
    notTaxDocument: 'Tento doklad nie je daňovým dokladom.',
    corrects: 'Opravuje doklad č. {number} zo dňa {date}.',
    correctionReason: 'Dôvod opravy',
    customerVatId: 'IČ DPH odberateľa',
    note: 'Poznámka',
    taxNote: 'Poznámka k DPH',
    taxableDateDefault: 'Dátum dodania',
  },
  en: {
    invoice: 'Invoice',
    invoiceTax: 'Invoice – tax document',
    proforma: 'Proforma invoice',
    creditNote: 'Credit note',
    creditNoteTax: 'Credit note – tax document',
    paymentReceipt: 'Tax document for received payment',
    numberPrefix: 'No.',
    supplier: 'Supplier',
    customer: 'Customer',
    ico: 'Company ID',
    dic: 'VAT ID',
    vatPayer: 'VAT payer',
    nonVatPayer: 'Not a VAT payer',
    issueDate: 'Issue date',
    taxableDate: 'Date of taxable supply',
    dueDate: 'Due date',
    paymentMethod: 'Payment method',
    methods: {
      bank_transfer: 'Bank transfer',
      cash: 'Cash',
      card: 'Card',
      cash_on_delivery: 'Cash on delivery',
      other: 'Other',
    },
    paymentDetails: 'Payment details',
    bank: 'Bank',
    accountNumber: 'Account number',
    iban: 'IBAN',
    bic: 'BIC',
    variableSymbol: 'Variable symbol',
    constantSymbol: 'Constant symbol',
    specificSymbol: 'Specific symbol',
    amountDue: 'Amount due',
    qrSpayd: 'QR payment',
    qrEpc: 'SEPA QR',
    description: 'Description',
    quantity: 'Qty',
    unit: 'Unit',
    unitPrice: 'Unit price',
    vatRate: 'VAT',
    lineTotal: 'Total',
    lineTotalExVat: 'Total excl. VAT',
    lineTotalIncVat: 'Total incl. VAT',
    discount: 'Discount',
    vatRecap: 'VAT summary',
    rate: 'Rate',
    base: 'Net',
    vat: 'VAT',
    total: 'Total',
    sum: 'Total',
    recapCzk: 'VAT converted to CZK',
    exchangeRate: 'Exchange rate',
    subtotal: 'Subtotal',
    rounding: 'Rounding',
    deposits: 'Advances paid',
    remaining: 'Remaining to pay',
    issuedBy: 'Issued by',
    page: 'Page',
    issuedIn: 'Issued with',
    notTaxDocument: 'This document is not a tax document.',
    corrects: 'Corrects document no. {number} dated {date}.',
    correctionReason: 'Reason for correction',
    customerVatId: 'Customer VAT ID',
    note: 'Note',
    taxNote: 'VAT note',
    taxableDateDefault: 'Taxable supply',
  },
}
