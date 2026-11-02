import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  buildSheetModel,
  type InvoiceSheetInput,
  type PartyModel,
  type RecapRow,
  type SheetImage,
} from '../model.ts'
import type { QrData } from '../types.ts'
import { imageSrc } from './image.ts'
import './sheet.css'
import { useInvoiceQr } from './useInvoiceQr.ts'

/** A4 in CSS px at 72 dpi, the unit the PDF styles are written in. */
export const PAPER_WIDTH = 595.28
export const PAPER_HEIGHT = 841.89

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

export interface InvoiceSheetProps {
  /** An issued document or a live draft (every field optional, see `InvoiceSheetDraft`). */
  doc: InvoiceSheetInput
  /**
   * Payment QR (see `buildInvoiceQr`). Leave `undefined` to let the sheet build it in the browser from the
   * document; pass `null` to show none (e.g. while the form is invalid) or a value pre-computed on the server.
   */
  qr?: QrData | null
  /** `fit` scales the paper to the container width; a number is a fixed zoom (1 = 595 px wide). */
  scale?: 'fit' | number
  /** Upper bound for `fit`. */
  maxScale?: number
  /** `compact` drops the A4 minimum height and the footer: a content-sized card for small previews. */
  density?: 'comfortable' | 'compact'
  /** Level of the document heading (title + number). Default 2. */
  headingLevel?: 2 | 3 | 4
  className?: string
  style?: CSSProperties
}

/** Observes the wrapper width and returns the zoom that fits the paper into it (null until measured). */
function useFitScale(
  ref: React.RefObject<HTMLElement | null>,
  enabled: boolean,
  maxScale: number,
): number | null {
  const [zoom, setZoom] = useState<number | null>(null)
  useIsoLayoutEffect(() => {
    const el = ref.current
    if (!enabled || !el) return
    const measure = () => {
      const w = el.clientWidth
      if (w > 0) setZoom(Math.min(maxScale, w / PAPER_WIDTH))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref, enabled, maxScale])
  return zoom
}

function Label({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h3 className="fk-label" id={id}>
      {children}
    </h3>
  )
}

function Party({ p, customer }: { p: PartyModel; customer?: boolean }) {
  const id = useId()
  return (
    <section
      className="fk-party"
      aria-labelledby={id}
      {...(customer ? { 'data-customer': '' } : {})}
    >
      <Label id={id}>{p.label}</Label>
      <p className="fk-party-name fk-serif" {...(p.name ? {} : { 'data-empty': '' })}>
        {p.name || '—'}
      </p>
      {p.street ? <p>{p.street}</p> : null}
      {p.cityLine ? <p>{p.cityLine}</p> : null}
      {p.country ? <p>{p.country}</p> : null}
      {p.ico || p.dic ? (
        <dl className="fk-ids">
          {p.ico ? (
            <div className="fk-id">
              <dt>{p.icoLabel}</dt>
              <dd>{p.ico}</dd>
            </div>
          ) : null}
          {p.dic ? (
            <div className="fk-id">
              <dt>{p.dicLabel}</dt>
              <dd>{p.dic}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
      {p.vatStatus ? (
        <p className="fk-bold" style={{ marginTop: 5 }}>
          {p.vatStatus}
        </p>
      ) : null}
      {p.registerNote ? (
        <p className="fk-muted" style={{ marginTop: 3, marginRight: -3, fontSize: '7.6px' }}>
          {p.registerNote}
        </p>
      ) : null}
      {p.contact ? (
        <p className="fk-muted" style={{ marginTop: 3 }}>
          {p.contact}
        </p>
      ) : null}
    </section>
  )
}

function QrCode({ qr, label }: { qr: QrData; label: string }) {
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${qr.viewBox} ${qr.viewBox}`}
      shapeRendering="crispEdges"
    >
      <title>{label}</title>
      <path d={qr.path} stroke="#000000" strokeWidth={1} fill="none" />
    </svg>
  )
}

function RecapTable({
  caption,
  heads,
  rows,
  sum,
}: {
  caption: string
  heads?: { rate: string; base: string; vat: string; total: string }
  rows: RecapRow[]
  sum?: RecapRow
}) {
  const cells = (r: RecapRow) => (
    <>
      <td>{r.rate}</td>
      <td className="r">{r.base}</td>
      <td className="r">{r.vat}</td>
      <td className="r">{r.total}</td>
    </>
  )
  return (
    <table className="fk-recap">
      <caption>{caption}</caption>
      <colgroup>
        <col style={{ width: 58 }} />
        <col />
        <col style={{ width: 62 }} />
        <col style={{ width: 68 }} />
      </colgroup>
      {heads ? (
        <thead>
          <tr>
            <th scope="col">{heads.rate}</th>
            <th scope="col" className="r">
              {heads.base}
            </th>
            <th scope="col" className="r">
              {heads.vat}
            </th>
            <th scope="col" className="r">
              {heads.total}
            </th>
          </tr>
        </thead>
      ) : null}
      <tbody>
        {rows.map((r) => (
          <tr key={r.key}>{cells(r)}</tr>
        ))}
      </tbody>
      {sum ? (
        <tfoot>
          <tr>{cells(sum)}</tr>
        </tfoot>
      ) : null}
    </table>
  )
}

/**
 * The invoice as it looks in the PDF, in HTML: same layout, labels, fonts and numbers (both are drawn from
 * `buildSheetModel`). Always a light paper, even in dark mode; scales to its container.
 */
export function InvoiceSheet({
  doc,
  qr,
  scale = 'fit',
  maxScale = 1.75,
  density = 'comfortable',
  headingLevel = 2,
  className,
  style,
}: InvoiceSheetProps) {
  const m = useMemo(() => buildSheetModel(doc), [doc])
  const wrapRef = useRef<HTMLDivElement>(null)
  const fit = useFitScale(wrapRef, scale === 'fit', maxScale)
  const zoom = scale === 'fit' ? fit : scale
  const autoQr = useInvoiceQr(doc, qr === undefined)
  const qrData = qr === undefined ? autoQr : qr
  const logo = useMemo(() => imageSrc((doc as { logo?: SheetImage }).logo), [doc])
  const signature = useMemo(() => imageSrc((doc as { signature?: SheetImage }).signature), [doc])
  const hasSignatureImage = signature !== null
  const Heading = `h${headingLevel}` as 'h2'
  const { t } = m

  return (
    <div
      ref={wrapRef}
      className={['fk-sheet-wrap', className].filter(Boolean).join(' ')}
      style={
        {
          ...style,
          ...(zoom ? { '--fk-zoom': zoom } : {}),
          '--fk-accent': m.accent,
        } as CSSProperties
      }
      {...(zoom === null ? { 'data-pending': '' } : {})}
    >
      <article
        className="fk-sheet"
        lang={m.lang}
        data-density={density}
        aria-label={m.documentName || t.document}
      >
        <div className="fk-body">
          <header className="fk-header">
            <div className="fk-brand">
              {logo ? <img className="fk-logo" src={logo} alt="" /> : null}
              <p className="fk-supplier-name">{m.supplierName}</p>
            </div>
            <Heading className="fk-heading" style={{ fontSize: 'inherit', fontWeight: 'inherit' }}>
              <span className="fk-title">{m.title}</span>
              <span
                className="fk-number fk-serif"
                {...(m.numberPending ? { 'data-pending': '' } : {})}
              >
                {m.number ?? m.pendingNumberText}
              </span>
            </Heading>
          </header>
          <div className="fk-rule" />
          <div className="fk-rule2" />

          <dl className="fk-meta">
            {m.meta.map((x) => (
              <div key={x.label} className="fk-meta-cell">
                <dt className="fk-label">{x.label}</dt>
                <dd className="fk-meta-value">{x.value}</dd>
              </div>
            ))}
          </dl>

          <div className="fk-parties">
            <Party p={m.supplier} />
            <Party p={m.customer} customer />
          </div>

          {m.correction ? (
            <div style={{ marginBottom: 10 }}>
              <p className="fk-bold">{m.correction.line}</p>
              {m.correction.reason ? <p className="fk-muted">{m.correction.reason}</p> : null}
            </div>
          ) : null}
          {m.headerText ? <p className="fk-intro">{m.headerText}</p> : null}

          <table className="fk-items">
            <colgroup>
              <col />
              <col style={{ width: 44 }} />
              <col style={{ width: 34 }} />
              <col style={{ width: 66 }} />
              {m.columns.showVat ? <col style={{ width: 34 }} /> : null}
              <col style={{ width: 76 }} />
            </colgroup>
            <thead>
              <tr>
                <th scope="col" className="c-desc" style={{ textAlign: 'left' }}>
                  {t.description}
                </th>
                <th scope="col" className="c-qty">
                  {t.quantity}
                </th>
                <th scope="col" className="c-unit">
                  {t.unit}
                </th>
                <th scope="col" className="c-price">
                  {m.columns.priceHeader}
                </th>
                {m.columns.showVat ? (
                  <th scope="col" className="c-vat">
                    {t.vatRate}
                  </th>
                ) : null}
                <th scope="col" className="c-total">
                  {m.columns.totalHeader}
                </th>
              </tr>
            </thead>
            <tbody>
              {m.lines.map((line, i) => (
                <tr key={`${i}-${line.title}`}>
                  <td className="c-desc">
                    <p className="fk-row-title">{line.title}</p>
                    {line.detail ? <p className="fk-row-detail">{line.detail}</p> : null}
                    {line.discount ? <p className="fk-row-detail">{line.discount}</p> : null}
                  </td>
                  <td className="c-qty">{line.quantity}</td>
                  <td className="c-unit">{line.unit}</td>
                  <td className="c-price">{line.unitPrice}</td>
                  {m.columns.showVat ? <td className="c-vat">{line.vat}</td> : null}
                  <td className="c-total fk-bold">{line.total}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="fk-bottom">
            <div className="fk-left">
              {m.payment ? (
                <section className="fk-pay" aria-label={m.payment.heading}>
                  {qrData ? (
                    <figure className="fk-qr">
                      <div className="fk-qr-frame">
                        <QrCode qr={qrData} label={m.payment.qrLabel(qrData.kind)} />
                      </div>
                      <figcaption className="fk-label">{m.payment.qrLabel(qrData.kind)}</figcaption>
                    </figure>
                  ) : null}
                  <div className="fk-pay-details">
                    <h3 className="fk-label">{m.payment.heading}</h3>
                    <dl>
                      {m.payment.rows.map((r) => (
                        <div key={r.key} className="fk-pay-row">
                          <dt>{r.key}</dt>
                          <dd className={r.bold ? 'fk-bold' : undefined}>{r.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </section>
              ) : null}
              {m.footerText ? <p className="fk-closing fk-serif">{m.footerText}</p> : null}
              {m.proformaNotice ? <p className="fk-notice">{m.proformaNotice}</p> : null}
              {m.signature ? (
                <div className="fk-signature">
                  {hasSignatureImage ? <img src={signature} alt="" /> : null}
                  <p className="fk-sig-line">{m.signature.issuedBy}</p>
                </div>
              ) : null}
            </div>

            <div className="fk-right">
              {m.recap ? (
                <RecapTable
                  caption={m.recap.heading}
                  heads={m.recap.heads}
                  rows={m.recap.rows}
                  sum={m.recap.sum}
                />
              ) : m.plainSums.length > 0 ? (
                <dl>
                  {m.plainSums.map((r) => (
                    <div key={r.key} className="fk-sum">
                      <dt>{r.key}</dt>
                      <dd>{r.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}

              {m.czkRecap ? (
                <>
                  <RecapTable caption={m.czkRecap.heading} rows={m.czkRecap.rows} />
                  <p
                    className="fk-rate-line fk-recap-rate"
                    style={{ marginTop: 5, fontSize: '7.6px' }}
                  >
                    {m.exchangeRateLine}
                  </p>
                </>
              ) : m.exchangeRateLine ? (
                <p className="fk-rate-line">{m.exchangeRateLine}</p>
              ) : null}

              <dl className="fk-sums">
                {m.adjustments.map((r) => (
                  <div key={r.key} className="fk-sum">
                    <dt>{r.key}</dt>
                    <dd>{r.value}</dd>
                  </div>
                ))}
              </dl>

              <div className="fk-total" role="group" aria-label={m.total.label}>
                <span className="fk-label">{m.total.label}</span>
                <strong className="fk-total-value fk-serif" style={{ fontWeight: 500 }}>
                  {m.total.value}
                </strong>
              </div>
            </div>
          </div>

          {m.note ? <p className="fk-note">{m.note}</p> : null}

          {m.legal ? (
            <section className="fk-legal">
              <h3 className="fk-label">{m.legal.heading}</h3>
              {m.legal.items.map((text) => (
                <p key={text}>{text}</p>
              ))}
            </section>
          ) : null}
        </div>

        <footer className="fk-footer">
          <p>{m.footer.supplierLine}</p>
          <div className="fk-footer-right">
            {m.footer.brand ? <p>{m.footer.brand}</p> : null}
            <p>{`${m.footer.pageLabel} 1 / 1`}</p>
          </div>
        </footer>
      </article>
    </div>
  )
}
