import {
  type ExportParty,
  type MoneyInput,
  parseDecimal,
  round,
  type VatTreatment,
  vatTreatmentText,
} from '@fakturky/domain'
import {
  Document,
  type DocumentProps,
  Image,
  Page,
  Path,
  StyleSheet,
  Svg,
  Text,
  View,
} from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import {
  amount,
  countryName,
  currencyLabel,
  exchangeRate,
  formatDate,
  groupIban,
  percent,
  quantity,
} from './format.ts'
import { LABELS, type Labels } from './i18n.ts'
import { amountDue } from './qr.ts'
import type { ImageBytes, InvoicePdfInput, QrData } from './types.ts'

const INK = '#1B1A17'
const MUTED = '#6B665B'
const RULE = '#D6CDBA'
const ACCENT = '#1F4D3C'

// No `lineHeight` anywhere: react-pdf 4.9 drops `render` (page number) texts or doubles line gaps when it is set.
const s = StyleSheet.create({
  page: {
    fontFamily: 'Inter',
    fontSize: 8.6,
    color: INK,
    paddingTop: 40,
    paddingHorizontal: 44,
    paddingBottom: 84,
  },
  label: {
    fontSize: 6.6,
    fontWeight: 500,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: MUTED,
  },
  muted: { color: MUTED },
  bold: { fontWeight: 600 },
  serif: { fontFamily: 'Fraunces', fontWeight: 500 },
  row: { flexDirection: 'row' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  rule: { marginTop: 14, borderTopWidth: 1.6, borderTopColor: ACCENT },
  rule2: { marginTop: 2.2, borderTopWidth: 0.5, borderTopColor: INK },
  meta: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: RULE },
  metaCell: { flex: 1, paddingVertical: 9, paddingRight: 8 },
  metaCellSep: { borderLeftWidth: 0.5, borderLeftColor: RULE, paddingLeft: 12 },
  metaValue: { fontWeight: 600, fontSize: 9, marginTop: 3 },
  parties: { flexDirection: 'row', paddingTop: 18, paddingBottom: 16, gap: 32 },
  party: { flex: 1 },
  partyCustomer: { borderLeftWidth: 1.2, borderLeftColor: ACCENT, paddingLeft: 14 },
  partyName: {
    fontFamily: 'Fraunces',
    fontWeight: 500,
    fontSize: 12.5,
    marginTop: 5,
    marginBottom: 4,
  },
  idRow: { flexDirection: 'row', marginTop: 1 },
  idKey: { color: MUTED },
  thead: {
    flexDirection: 'row',
    borderTopWidth: 0.9,
    borderTopColor: INK,
    borderBottomWidth: 0.5,
    borderBottomColor: RULE,
    paddingVertical: 5,
  },
  tr: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: RULE, paddingVertical: 7 },
  cDesc: { flex: 1, paddingRight: 8 },
  cQty: { width: 44, textAlign: 'right' },
  cUnit: { width: 34, textAlign: 'center' },
  cPrice: { width: 66, textAlign: 'right' },
  cVat: { width: 34, textAlign: 'right' },
  cTotal: { width: 76, textAlign: 'right' },
  th: {
    fontSize: 6.6,
    fontWeight: 500,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: MUTED,
  },
  rowTitle: { fontWeight: 600 },
  rowDetail: { color: MUTED, fontSize: 7.8, marginTop: 1 },
  bottom: { flexDirection: 'row', marginTop: 22, gap: 28 },
  left: { flex: 1 },
  right: { width: 218 },
  pay: {
    flexDirection: 'row',
    borderWidth: 0.6,
    borderColor: RULE,
    borderRadius: 4,
    padding: 10,
    gap: 11,
  },
  qrBox: { width: 80, alignItems: 'center' },
  qrFrame: {
    width: 80,
    height: 80,
    padding: 5,
    borderWidth: 0.5,
    borderColor: RULE,
    backgroundColor: '#FFFFFF',
  },
  payRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 3.5 },
  payKey: { color: MUTED, fontSize: 7.6 },
  payVal: { fontSize: 8, textAlign: 'right' },
  recapRow: {
    flexDirection: 'row',
    paddingVertical: 3.5,
    borderTopWidth: 0.5,
    borderTopColor: RULE,
  },
  total: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: INK,
    borderBottomWidth: 0.5,
    borderBottomColor: INK,
    paddingVertical: 11,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalValue: {
    fontFamily: 'Fraunces',
    fontWeight: 500,
    fontSize: 21,
    lineHeight: 1,
    letterSpacing: -0.3,
  },
  legal: { marginTop: 16, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: RULE },
  footer: {
    position: 'absolute',
    left: 44,
    right: 44,
    bottom: 26,
    borderTopWidth: 0.5,
    borderTopColor: RULE,
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 24,
    fontSize: 7,
    color: MUTED,
  },
  footText: { fontSize: 7 },
  sigLine: {
    width: 170,
    borderTopWidth: 0.6,
    borderTopColor: INK,
    paddingTop: 4,
    fontSize: 7.6,
    color: MUTED,
    textAlign: 'center',
  },
})

/** Tax documents state the unit price without VAT; derive it from the line base when prices were entered gross. */
function unitPriceNet(
  qty: MoneyInput,
  entered: MoneyInput,
  base: string | undefined,
  gross?: boolean,
) {
  const q = parseDecimal(qty)
  return gross && base && !q.isZero() ? round(parseDecimal(base).div(q), 2) : entered
}

function titleFor(doc: InvoicePdfInput, t: Labels): string {
  switch (doc.type) {
    case 'proforma':
      return t.proforma
    case 'credit_note':
      return doc.vatPayer ? t.creditNoteTax : t.creditNote
    case 'payment_receipt':
      return t.paymentReceipt
    default:
      return doc.vatPayer ? t.invoiceTax : t.invoice
  }
}

function imageSource(bytes: NonNullable<ImageBytes>) {
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50
  return { data: Buffer.from(bytes), format: (isPng ? 'png' : 'jpg') as 'png' | 'jpg' }
}

function PartyBlock({
  p,
  title,
  t,
  lang,
  vatPayer,
  customer,
  accent,
}: {
  p: ExportParty
  title: string
  t: Labels
  lang: InvoicePdfInput['language']
  vatPayer?: boolean
  customer?: boolean
  accent: string
}) {
  const cc = (p.country ?? 'CZ').toUpperCase()
  return (
    <View style={customer ? [s.party, s.partyCustomer, { borderLeftColor: accent }] : s.party}>
      <Text style={s.label}>{title}</Text>
      <Text style={s.partyName}>{p.name}</Text>
      <Text>{p.street}</Text>
      <Text>{`${p.zip} ${p.city}`}</Text>
      <Text>{countryName(cc, lang)}</Text>
      <View style={{ marginTop: 6 }}>
        {p.ico ? (
          <View style={s.idRow}>
            <Text style={[s.idKey, { width: lang === 'en' ? 58 : 34 }]}>{t.ico}</Text>
            <Text style={s.bold}>{p.ico}</Text>
          </View>
        ) : null}
        {p.dic ? (
          <View style={s.idRow}>
            <Text style={[s.idKey, { width: lang === 'en' ? 58 : 34 }]}>{t.dic}</Text>
            <Text style={s.bold}>{p.dic}</Text>
          </View>
        ) : null}
      </View>
      {vatPayer !== undefined ? (
        <Text style={[s.bold, { marginTop: 5 }]}>{vatPayer ? t.vatPayer : t.nonVatPayer}</Text>
      ) : null}
      {p.registerNote ? (
        <Text style={[s.muted, { marginTop: 3, fontSize: 7.6 }]}>{p.registerNote}</Text>
      ) : null}
      {p.email || p.phone ? (
        <Text style={[s.muted, { marginTop: 3 }]}>
          {[p.email, p.phone].filter(Boolean).join('  ·  ')}
        </Text>
      ) : null}
    </View>
  )
}

function Qr({ qr }: { qr: QrData }) {
  return (
    <Svg viewBox={`0 0 ${qr.viewBox} ${qr.viewBox}`} style={{ width: 70, height: 70 }}>
      <Path d={qr.path} stroke="#000000" strokeWidth={1} />
    </Svg>
  )
}

export interface InvoiceDocumentProps {
  doc: InvoicePdfInput
  /** Pre-rendered payment QR (see `buildInvoiceQr`). */
  qr?: QrData | null
}

export function InvoiceDocument({ doc, qr }: InvoiceDocumentProps): ReactElement<DocumentProps> {
  const accent = /^#[0-9a-fA-F]{6}$/.test(doc.accentColor ?? '')
    ? (doc.accentColor as string)
    : ACCENT
  const lang = doc.language
  const t = LABELS[lang]
  const cur = doc.currency.toUpperCase()
  const cl = currencyLabel(cur)
  const money = (v: string | number) => `${amount(v, lang)} ${cl}`
  const payer = doc.vatPayer
  const isProforma = doc.type === 'proforma'
  const showVatCols = payer
  const showRecap = payer && !isProforma && doc.totals.recap.length > 0
  const foreign = cur !== 'CZK'
  const rate = parseDecimal(doc.exchangeRate ?? doc.totals.exchangeRate)
  const title = titleFor(doc, t)
  const pay = doc.payment
  const acct = pay?.bankAccount
  const due = amountDue(doc)
  const deposits = parseDecimal(doc.paidDeposits ?? 0)
  const hasRounding = !parseDecimal(doc.totals.rounding).isZero()

  const priceHeader = t.unitPrice
  const totalHeader = !payer
    ? t.lineTotal
    : doc.pricesIncludeVat
      ? t.lineTotalIncVat
      : t.lineTotalExVat

  const legalTexts: { treatment: VatTreatment; text: string }[] = []
  for (const r of doc.totals.recap) {
    if (r.vatTreatment !== 'standard' && !legalTexts.some((l) => l.treatment === r.vatTreatment)) {
      legalTexts.push({ treatment: r.vatTreatment, text: vatTreatmentText(r.vatTreatment, lang) })
    }
  }

  const methodLabel = pay ? (t.methods[pay.method] ?? pay.method) : null
  const meta: { label: string; value: string }[] = [
    { label: t.issueDate, value: formatDate(doc.issueDate, lang) },
  ]
  if (payer && doc.taxableDate)
    meta.push({ label: t.taxableDate, value: formatDate(doc.taxableDate, lang) })
  if (pay) meta.push({ label: t.dueDate, value: formatDate(pay.dueDate, lang) })
  if (methodLabel) meta.push({ label: t.paymentMethod, value: methodLabel })

  const accountLine = acct?.accountNumber
    ? `${acct.accountNumber}${acct.bankCode ? `/${acct.bankCode}` : ''}`
    : null

  return (
    <Document
      title={`${title} ${doc.number}`}
      author={doc.supplier.name}
      subject={title}
      creator={doc.brandName}
      producer={doc.brandName}
      language={lang}
    >
      <Page size="A4" style={s.page}>
        <View fixed style={s.footer}>
          <Text style={[s.footText, { flex: 1 }]}>
            {[doc.supplier.name, doc.supplier.registerNote]
              .filter(Boolean)
              .map((part) => String(part).replace(/\.+$/, ''))
              .join(', ')}
            .
          </Text>
          <View style={{ alignItems: 'flex-end' }}>
            {doc.showBrand === false ? null : (
              <Text style={s.footText}>{`${t.issuedIn} ${doc.brandName}`}</Text>
            )}
            <Text
              style={s.footText}
              render={({ pageNumber, totalPages }) => `${t.page} ${pageNumber} / ${totalPages}`}
            />
          </View>
        </View>
        <View style={s.header}>
          <View style={[s.row, { alignItems: 'center', gap: 10, flex: 1, paddingRight: 20 }]}>
            {doc.logo ? (
              <Image
                src={imageSource(doc.logo)}
                style={{ width: 110, height: 38, objectFit: 'contain', objectPositionX: 0 }}
              />
            ) : null}
            <Text
              style={{
                fontFamily: 'Fraunces',
                fontWeight: 600,
                fontSize: 13,
                letterSpacing: -0.15,
              }}
            >
              {doc.supplier.name}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 8.6, fontWeight: 500, color: MUTED, marginBottom: 3 }}>
              {title}
            </Text>
            <Text
              style={{
                fontFamily: 'Fraunces',
                fontWeight: 500,
                fontSize: 26,
                lineHeight: 1,
                letterSpacing: -0.5,
                paddingBottom: 2,
              }}
            >{`${t.numberPrefix} ${doc.number}`}</Text>
          </View>
        </View>
        <View style={[s.rule, { borderTopColor: accent }]} />
        <View style={s.rule2} />

        <View style={s.meta}>
          {meta.map((m, i) => (
            <View key={m.label} style={i === 0 ? s.metaCell : [s.metaCell, s.metaCellSep]}>
              <Text style={s.label}>{m.label}</Text>
              <Text style={s.metaValue}>{m.value}</Text>
            </View>
          ))}
        </View>

        <View style={s.parties}>
          <PartyBlock
            p={doc.supplier}
            title={t.supplier}
            t={t}
            lang={lang}
            vatPayer={payer}
            accent={accent}
          />
          <PartyBlock
            p={doc.customer}
            title={t.customer}
            t={t}
            lang={lang}
            customer
            accent={accent}
          />
        </View>

        {doc.type === 'credit_note' && doc.originalDocument ? (
          <View style={{ marginBottom: 10 }}>
            <Text style={s.bold}>
              {t.corrects
                .replace('{number}', doc.originalDocument.number)
                .replace('{date}', formatDate(doc.originalDocument.issueDate, lang))}
            </Text>
            {doc.correctionReason ? (
              <Text style={s.muted}>{`${t.correctionReason}: ${doc.correctionReason}`}</Text>
            ) : null}
          </View>
        ) : null}
        {doc.headerText ? <Text style={{ marginBottom: 10 }}>{doc.headerText}</Text> : null}

        <View fixed style={s.thead}>
          <Text style={[s.th, s.cDesc]}>{t.description}</Text>
          <Text style={[s.th, s.cQty]}>{t.quantity}</Text>
          <Text style={[s.th, s.cUnit]}>{t.unit}</Text>
          <Text style={[s.th, s.cPrice]}>{priceHeader}</Text>
          {showVatCols ? <Text style={[s.th, s.cVat]}>{t.vatRate}</Text> : null}
          <Text style={[s.th, s.cTotal]}>{totalHeader}</Text>
        </View>
        {doc.lines.map((line, i) => {
          const lt = doc.totals.lines[i]
          const discount =
            line.discountPercent !== undefined && line.discountPercent !== null
              ? parseDecimal(line.discountPercent)
              : null
          return (
            <View key={`${i}-${line.description}`} style={s.tr} wrap={false}>
              <View style={s.cDesc}>
                <Text style={s.rowTitle}>{line.description}</Text>
                {line.detail ? <Text style={s.rowDetail}>{line.detail}</Text> : null}
                {discount && !discount.isZero() ? (
                  <Text style={s.rowDetail}>{`${t.discount} ${percent(discount.toString())}`}</Text>
                ) : null}
              </View>
              <Text style={s.cQty}>{quantity(line.quantity, lang)}</Text>
              <Text style={s.cUnit}>{line.unit ?? ''}</Text>
              <Text style={s.cPrice}>
                {amount(
                  unitPriceNet(line.quantity, line.unitPrice, lt?.base, doc.pricesIncludeVat),
                  lang,
                )}
              </Text>
              {showVatCols ? (
                <Text style={s.cVat}>
                  {lt && lt.vatTreatment === 'standard' ? percent(lt.vatRate) : '–'}
                </Text>
              ) : null}
              <Text style={[s.cTotal, s.bold]}>{lt ? amount(lt.base, lang) : ''}</Text>
            </View>
          )
        })}

        <View wrap={false} style={s.bottom}>
          <View style={s.left}>
            {pay && (acct || pay.variableSymbol) ? (
              <View style={s.pay}>
                {qr ? (
                  <View style={s.qrBox}>
                    <View style={s.qrFrame}>
                      <Qr qr={qr} />
                    </View>
                    <Text style={[s.label, { marginTop: 4 }]}>
                      {qr.kind === 'spayd' ? t.qrSpayd : t.qrEpc}
                    </Text>
                  </View>
                ) : null}
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>{t.paymentDetails}</Text>
                  {acct?.bankName ? <PayRow k={t.bank} v={acct.bankName} /> : null}
                  {accountLine ? <PayRow k={t.accountNumber} v={accountLine} bold /> : null}
                  {acct ? <PayRow k={t.iban} v={groupIban(acct.iban)} /> : null}
                  {acct?.bic ? <PayRow k={t.bic} v={acct.bic} /> : null}
                  {pay.variableSymbol ? (
                    <PayRow k={t.variableSymbol} v={pay.variableSymbol} bold />
                  ) : null}
                  {pay.constantSymbol ? (
                    <PayRow k={t.constantSymbol} v={pay.constantSymbol} />
                  ) : null}
                  {pay.specificSymbol ? (
                    <PayRow k={t.specificSymbol} v={pay.specificSymbol} />
                  ) : null}
                </View>
              </View>
            ) : null}
            {doc.footerText ? (
              <Text
                style={{
                  fontFamily: 'Fraunces',
                  fontWeight: 500,
                  fontSize: 12,
                  marginTop: 14,
                  color: accent,
                }}
              >
                {doc.footerText}
              </Text>
            ) : null}
            {isProforma ? <Text style={[s.bold, { marginTop: 8 }]}>{t.notTaxDocument}</Text> : null}

            {doc.signature || doc.issuedBy ? (
              <View style={{ marginTop: 22, alignItems: 'flex-start' }}>
                {doc.signature ? (
                  <View style={{ width: 150, height: 44 }}>
                    <Image
                      src={imageSource(doc.signature)}
                      style={{ width: 150, height: 44, objectFit: 'contain', objectPositionX: 0 }}
                    />
                  </View>
                ) : null}
                <Text style={s.sigLine}>
                  {doc.issuedBy ? `${t.issuedBy}: ${doc.issuedBy}` : t.issuedBy}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={s.right}>
            {showRecap ? (
              <View>
                <View style={[s.row, { paddingBottom: 4 }]}>
                  <Text style={[s.th, { flex: 1 }]}>{`${t.vatRecap} (${cl})`}</Text>
                </View>
                <View style={[s.row, { paddingBottom: 4 }]}>
                  <Text style={[s.th, { width: 58 }]}>{t.rate}</Text>
                  <Text style={[s.th, { flex: 1, textAlign: 'right' }]}>{t.base}</Text>
                  <Text style={[s.th, { width: 62, textAlign: 'right' }]}>{t.vat}</Text>
                  <Text style={[s.th, { width: 68, textAlign: 'right' }]}>{t.total}</Text>
                </View>
                {doc.totals.recap.map((r) => (
                  <View key={`${r.vatTreatment}-${r.vatRate}`} style={s.recapRow}>
                    <Text style={{ width: 58 }}>
                      {r.vatTreatment === 'standard'
                        ? percent(r.vatRate)
                        : t.treatments[r.vatTreatment]}
                    </Text>
                    <Text style={{ flex: 1, textAlign: 'right' }}>{amount(r.base, lang)}</Text>
                    <Text style={{ width: 62, textAlign: 'right' }}>{amount(r.vat, lang)}</Text>
                    <Text style={{ width: 68, textAlign: 'right' }}>{amount(r.total, lang)}</Text>
                  </View>
                ))}
                <View
                  style={[
                    s.recapRow,
                    { borderTopColor: INK, borderTopWidth: 0.6, fontWeight: 600 },
                  ]}
                >
                  <Text style={[s.bold, { width: 58 }]}>{t.sum}</Text>
                  <Text style={[s.bold, { flex: 1, textAlign: 'right' }]}>
                    {amount(doc.totals.subtotal, lang)}
                  </Text>
                  <Text style={[s.bold, { width: 62, textAlign: 'right' }]}>
                    {amount(doc.totals.vatTotal, lang)}
                  </Text>
                  <Text style={[s.bold, { width: 68, textAlign: 'right' }]}>
                    {amount(doc.totals.totalBeforeRounding, lang)}
                  </Text>
                </View>
              </View>
            ) : (
              <View>
                {payer ? (
                  <>
                    <SumRow k={t.base} v={money(doc.totals.subtotal)} />
                    <SumRow k={t.vat} v={money(doc.totals.vatTotal)} />
                  </>
                ) : null}
              </View>
            )}

            {foreign && payer && showRecap ? (
              <View style={{ marginTop: 12 }}>
                <Text style={[s.th, { paddingBottom: 4 }]}>{`${t.recapCzk} (Kč)`}</Text>
                {doc.totals.recap.map((r) => (
                  <View key={`czk-${r.vatTreatment}-${r.vatRate}`} style={s.recapRow}>
                    <Text style={{ width: 58 }}>
                      {r.vatTreatment === 'standard'
                        ? percent(r.vatRate)
                        : t.treatments[r.vatTreatment]}
                    </Text>
                    <Text style={{ flex: 1, textAlign: 'right' }}>
                      {amount(r.baseCzk ?? '0', lang)}
                    </Text>
                    <Text style={{ width: 62, textAlign: 'right' }}>
                      {amount(r.vatCzk ?? '0', lang)}
                    </Text>
                    <Text style={{ width: 68, textAlign: 'right' }}>
                      {amount(r.totalCzk ?? '0', lang)}
                    </Text>
                  </View>
                ))}
                <Text style={[s.muted, { marginTop: 5, fontSize: 7.6 }]}>
                  {`${t.exchangeRate}: 1 ${cur} = ${exchangeRate(rate, lang)} Kč`}
                </Text>
              </View>
            ) : foreign ? (
              <Text
                style={[s.muted, { marginTop: 8 }]}
              >{`${t.exchangeRate}: 1 ${cur} = ${exchangeRate(rate, lang)} Kč`}</Text>
            ) : null}

            <View style={{ marginTop: 8 }}>
              {hasRounding ? <SumRow k={t.rounding} v={money(doc.totals.rounding)} /> : null}
              {!deposits.isZero() ? (
                <SumRow k={t.deposits} v={money(`-${deposits.abs().toString()}`)} />
              ) : null}
            </View>

            <View style={s.total}>
              <Text style={s.label}>{deposits.isZero() ? t.amountDue : t.remaining}</Text>
              <Text style={s.totalValue}>{money(due)}</Text>
            </View>
          </View>
        </View>

        {doc.note ? (
          <View style={{ marginTop: 14 }}>
            <Text style={s.muted}>{doc.note}</Text>
          </View>
        ) : null}

        {legalTexts.length > 0 ? (
          <View style={s.legal} wrap={false}>
            <Text style={[s.label, { marginBottom: 3 }]}>{t.taxNote}</Text>
            {legalTexts.map((l) => (
              <Text key={l.treatment} style={{ fontSize: 8.2 }}>
                {l.text}
                {l.treatment === 'eu_reverse_charge' && doc.customer.dic
                  ? ` — ${t.customerVatId}: ${doc.customer.dic}`
                  : ''}
              </Text>
            ))}
          </View>
        ) : null}
      </Page>
    </Document>
  )
}

function PayRow({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <View style={s.payRow}>
      <Text style={s.payKey}>{k}</Text>
      <Text style={bold ? [s.payVal, s.bold] : s.payVal}>{v}</Text>
    </View>
  )
}

function SumRow({ k, v }: { k: string; v: string }) {
  return (
    <View style={[s.row, { justifyContent: 'space-between', paddingVertical: 2 }]}>
      <Text style={s.muted}>{k}</Text>
      <Text>{v}</Text>
    </View>
  )
}
