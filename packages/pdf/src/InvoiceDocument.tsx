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
import type { ComponentProps, ReactElement } from 'react'
import { buildSheetModel, DEFAULT_ACCENT, type PartyModel, type RecapRow } from './model.ts'
import type { ImageBytes, InvoicePdfInput, QrData } from './types.ts'

const INK = '#1B1A17'
const MUTED = '#6B665B'
const RULE = '#D6CDBA'
const ACCENT = DEFAULT_ACCENT

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

function imageSource(bytes: NonNullable<ImageBytes>) {
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50
  return { data: Buffer.from(bytes), format: (isPng ? 'png' : 'jpg') as 'png' | 'jpg' }
}

function PartyBlock({
  p,
  customer,
  accent,
  idKeyWidth,
}: {
  p: PartyModel
  customer?: boolean
  accent: string
  idKeyWidth: number
}) {
  return (
    <View style={customer ? [s.party, s.partyCustomer, { borderLeftColor: accent }] : s.party}>
      <Text style={s.label}>{p.label}</Text>
      <Text style={s.partyName}>{p.name}</Text>
      <Text>{p.street}</Text>
      <Text>{p.cityLine}</Text>
      <Text>{p.country}</Text>
      <View style={{ marginTop: 6 }}>
        {p.ico ? (
          <View style={s.idRow}>
            <Text style={[s.idKey, { width: idKeyWidth }]}>{p.icoLabel}</Text>
            <Text style={s.bold}>{p.ico}</Text>
          </View>
        ) : null}
        {p.dic ? (
          <View style={s.idRow}>
            <Text style={[s.idKey, { width: idKeyWidth }]}>{p.dicLabel}</Text>
            <Text style={s.bold}>{p.dic}</Text>
          </View>
        ) : null}
      </View>
      {p.vatStatus ? <Text style={[s.bold, { marginTop: 5 }]}>{p.vatStatus}</Text> : null}
      {p.registerNote ? (
        <Text style={[s.muted, { marginTop: 3, fontSize: 7.6 }]}>{p.registerNote}</Text>
      ) : null}
      {p.contact ? <Text style={[s.muted, { marginTop: 3 }]}>{p.contact}</Text> : null}
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
  const m = buildSheetModel(doc)
  const { accent, lang, t } = m
  const idKeyWidth = lang === 'en' ? 58 : 34

  return (
    <Document
      title={m.documentName}
      author={doc.supplier.name}
      subject={m.title}
      creator={doc.brandName}
      producer={doc.brandName}
      language={lang}
    >
      <Page size="A4" style={s.page}>
        <View fixed style={s.footer}>
          <Text style={[s.footText, { flex: 1 }]}>{m.footer.supplierLine}</Text>
          <View style={{ alignItems: 'flex-end' }}>
            {m.footer.brand ? <Text style={s.footText}>{m.footer.brand}</Text> : null}
            <Text
              style={s.footText}
              render={({ pageNumber, totalPages }) =>
                `${m.footer.pageLabel} ${pageNumber} / ${totalPages}`
              }
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
              {m.supplierName}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 8.6, fontWeight: 500, color: MUTED, marginBottom: 3 }}>
              {m.title}
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
            >
              {m.number ?? m.pendingNumberText}
            </Text>
          </View>
        </View>
        <View style={[s.rule, { borderTopColor: accent }]} />
        <View style={s.rule2} />

        <View style={s.meta}>
          {m.meta.map((x, i) => (
            <View key={x.label} style={i === 0 ? s.metaCell : [s.metaCell, s.metaCellSep]}>
              <Text style={s.label}>{x.label}</Text>
              <Text style={s.metaValue}>{x.value}</Text>
            </View>
          ))}
        </View>

        <View style={s.parties}>
          <PartyBlock p={m.supplier} accent={accent} idKeyWidth={idKeyWidth} />
          <PartyBlock p={m.customer} customer accent={accent} idKeyWidth={idKeyWidth} />
        </View>

        {m.correction ? (
          <View style={{ marginBottom: 10 }}>
            <Text style={s.bold}>{m.correction.line}</Text>
            {m.correction.reason ? <Text style={s.muted}>{m.correction.reason}</Text> : null}
          </View>
        ) : null}
        {m.headerText ? <Text style={{ marginBottom: 10 }}>{m.headerText}</Text> : null}

        <View fixed style={s.thead}>
          <Text style={[s.th, s.cDesc]}>{t.description}</Text>
          <Text style={[s.th, s.cQty]}>{t.quantity}</Text>
          <Text style={[s.th, s.cUnit]}>{t.unit}</Text>
          <Text style={[s.th, s.cPrice]}>{m.columns.priceHeader}</Text>
          {m.columns.showVat ? <Text style={[s.th, s.cVat]}>{t.vatRate}</Text> : null}
          <Text style={[s.th, s.cTotal]}>{m.columns.totalHeader}</Text>
        </View>
        {m.lines.map((line, i) => (
          <View key={`${i}-${line.title}`} style={s.tr} wrap={false}>
            <View style={s.cDesc}>
              <Text style={s.rowTitle}>{line.title}</Text>
              {line.detail ? <Text style={s.rowDetail}>{line.detail}</Text> : null}
              {line.discount ? <Text style={s.rowDetail}>{line.discount}</Text> : null}
            </View>
            <Text style={s.cQty}>{line.quantity}</Text>
            <Text style={s.cUnit}>{line.unit}</Text>
            <Text style={s.cPrice}>{line.unitPrice}</Text>
            {m.columns.showVat ? <Text style={s.cVat}>{line.vat}</Text> : null}
            <Text style={[s.cTotal, s.bold]}>{line.total}</Text>
          </View>
        ))}

        <View wrap={false} style={s.bottom}>
          <View style={s.left}>
            {m.payment ? (
              <View style={s.pay}>
                {qr ? (
                  <View style={s.qrBox}>
                    <View style={s.qrFrame}>
                      <Qr qr={qr} />
                    </View>
                    <Text style={[s.label, { marginTop: 4 }]}>{m.payment.qrLabel(qr.kind)}</Text>
                  </View>
                ) : null}
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>{m.payment.heading}</Text>
                  {m.payment.rows.map((r) => (
                    <PayRow key={r.key} k={r.key} v={r.value} bold={r.bold ?? false} />
                  ))}
                </View>
              </View>
            ) : null}
            {m.footerText ? (
              <Text
                style={{
                  fontFamily: 'Fraunces',
                  fontWeight: 500,
                  fontSize: 12,
                  marginTop: 14,
                  color: accent,
                }}
              >
                {m.footerText}
              </Text>
            ) : null}
            {m.proformaNotice ? (
              <Text style={[s.bold, { marginTop: 8 }]}>{m.proformaNotice}</Text>
            ) : null}

            {m.signature ? (
              <View style={{ marginTop: 22, alignItems: 'flex-start' }}>
                {doc.signature ? (
                  <View style={{ width: 150, height: 44 }}>
                    <Image
                      src={imageSource(doc.signature)}
                      style={{ width: 150, height: 44, objectFit: 'contain', objectPositionX: 0 }}
                    />
                  </View>
                ) : null}
                <Text style={s.sigLine}>{m.signature.issuedBy}</Text>
              </View>
            ) : null}
          </View>

          <View style={s.right}>
            {m.recap ? (
              <View>
                <View style={[s.row, { paddingBottom: 4 }]}>
                  <Text style={[s.th, { flex: 1 }]}>{m.recap.heading}</Text>
                </View>
                <View style={[s.row, { paddingBottom: 4 }]}>
                  <Text style={[s.th, { width: 58 }]}>{m.recap.heads.rate}</Text>
                  <Text style={[s.th, { flex: 1, textAlign: 'right' }]}>{m.recap.heads.base}</Text>
                  <Text style={[s.th, { width: 62, textAlign: 'right' }]}>{m.recap.heads.vat}</Text>
                  <Text style={[s.th, { width: 68, textAlign: 'right' }]}>
                    {m.recap.heads.total}
                  </Text>
                </View>
                {m.recap.rows.map((r) => (
                  <RecapLine key={r.key} r={r} style={s.recapRow} />
                ))}
                <RecapLine
                  r={m.recap.sum}
                  bold
                  style={[s.recapRow, { borderTopColor: INK, borderTopWidth: 0.6 }]}
                />
              </View>
            ) : (
              <View>
                {m.plainSums.map((r) => (
                  <SumRow key={r.key} k={r.key} v={r.value} />
                ))}
              </View>
            )}

            {m.czkRecap ? (
              <View style={{ marginTop: 12 }}>
                <Text style={[s.th, { paddingBottom: 4 }]}>{m.czkRecap.heading}</Text>
                {m.czkRecap.rows.map((r) => (
                  <RecapLine key={r.key} r={r} style={s.recapRow} />
                ))}
                <Text style={[s.muted, { marginTop: 5, fontSize: 7.6 }]}>{m.exchangeRateLine}</Text>
              </View>
            ) : m.exchangeRateLine ? (
              <Text style={[s.muted, { marginTop: 8 }]}>{m.exchangeRateLine}</Text>
            ) : null}

            <View style={{ marginTop: 8 }}>
              {m.adjustments.map((r) => (
                <SumRow key={r.key} k={r.key} v={r.value} />
              ))}
            </View>

            <View style={s.total}>
              <Text style={s.label}>{m.total.label}</Text>
              <Text style={s.totalValue}>{m.total.value}</Text>
            </View>
          </View>
        </View>

        {m.note ? (
          <View style={{ marginTop: 14 }}>
            <Text style={s.muted}>{m.note}</Text>
          </View>
        ) : null}

        {m.legal ? (
          <View style={s.legal} wrap={false}>
            <Text style={[s.label, { marginBottom: 3 }]}>{m.legal.heading}</Text>
            {m.legal.items.map((text) => (
              <Text key={text} style={{ fontSize: 8.2 }}>
                {text}
              </Text>
            ))}
          </View>
        ) : null}
      </Page>
    </Document>
  )
}

function RecapLine({
  r,
  bold,
  style,
}: {
  r: RecapRow
  bold?: boolean
  style: ComponentProps<typeof View>['style']
}) {
  const b = bold ? s.bold : undefined
  return (
    <View style={style}>
      <Text style={[b ?? {}, { width: 58 }]}>{r.rate}</Text>
      <Text style={[b ?? {}, { flex: 1, textAlign: 'right' }]}>{r.base}</Text>
      <Text style={[b ?? {}, { width: 62, textAlign: 'right' }]}>{r.vat}</Text>
      <Text style={[b ?? {}, { width: 68, textAlign: 'right' }]}>{r.total}</Text>
    </View>
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
