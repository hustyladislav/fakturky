import { BRAND } from '@fakturky/core/brand'
import { Body, Button, Container, Head, Html, Preview, Text } from '@react-email/components'

const paper = '#F6F2EA'
const ink = '#1B1A17'
const muted = '#6B665B'
const green = '#1F4D3C'
const serif = 'Georgia, "Times New Roman", serif'
const sans = '-apple-system, "Segoe UI", Helvetica, Arial, sans-serif'

type Lang = 'cs' | 'sk' | 'en'

const COPY: Record<
  Lang,
  {
    hello: string
    invoice: (n: string, total: string, due: string) => string
    reminder: (n: string, total: string, due: string) => string
    attached: string
    button: string
    sentVia: string
    subject: (n: string, who: string) => string
    subjectReminder: (n: string) => string
  }
> = {
  cs: {
    hello: 'Dobrý den,',
    invoice: (n, t, d) => `posíláme vám fakturu ${n} na částku ${t} se splatností ${d}.`,
    reminder: (n, t, d) =>
      `dovolujeme si vás upozornit, že faktura ${n} na částku ${t} je po splatnosti (splatnost ${d}).`,
    attached: 'PDF najdete v příloze, fakturu si můžete také otevřít online.',
    button: 'Zobrazit fakturu',
    sentVia: 'Odesláno přes',
    subject: (n, who) => `Faktura ${n} od ${who}`,
    subjectReminder: (n) => `Připomenutí platby: faktura ${n}`,
  },
  sk: {
    hello: 'Dobrý deň,',
    invoice: (n, t, d) => `posielame vám faktúru ${n} na sumu ${t} so splatnosťou ${d}.`,
    reminder: (n, t, d) =>
      `dovoľujeme si vás upozorniť, že faktúra ${n} na sumu ${t} je po splatnosti (splatnosť ${d}).`,
    attached: 'PDF nájdete v prílohe, faktúru si môžete otvoriť aj online.',
    button: 'Zobraziť faktúru',
    sentVia: 'Odoslané cez',
    subject: (n, who) => `Faktúra ${n} od ${who}`,
    subjectReminder: (n) => `Pripomenutie platby: faktúra ${n}`,
  },
  en: {
    hello: 'Hello,',
    invoice: (n, t, d) => `please find invoice ${n} for ${t}, due on ${d}.`,
    reminder: (n, t, d) => `this is a reminder that invoice ${n} for ${t} is overdue (due ${d}).`,
    attached: 'The PDF is attached; you can also open the invoice online.',
    button: 'View invoice',
    sentVia: 'Sent with',
    subject: (n, who) => `Invoice ${n} from ${who}`,
    subjectReminder: (n) => `Payment reminder: invoice ${n}`,
  },
}

export type InvoiceEmailProps = {
  language?: Lang
  supplierName: string
  number: string
  /** Pre-formatted, e.g. "12 100,00 Kč". */
  total: string
  /** Pre-formatted, e.g. "15. 11. 2026". */
  dueDate: string
  publicUrl: string
  message?: string | null
  isReminder?: boolean
}

export function invoiceEmailSubject(
  p: Pick<InvoiceEmailProps, 'number' | 'supplierName' | 'isReminder'>,
) {
  return p.isReminder
    ? `Připomenutí platby: faktura ${p.number}`
    : `Faktura ${p.number} od ${p.supplierName}`
}

export function InvoiceEmail(p: InvoiceEmailProps) {
  const lang = p.language ?? 'cs'
  const c = COPY[lang]
  return (
    <Html lang={lang}>
      <Head />
      <Preview>{invoiceEmailSubject(p)}</Preview>
      <Body style={{ backgroundColor: paper, margin: 0, padding: '32px 0', fontFamily: sans }}>
        <Container
          style={{
            maxWidth: 520,
            backgroundColor: '#FCFAF5',
            border: '1px solid #E2DACB',
            borderRadius: 12,
            padding: 32,
          }}
        >
          <Text style={{ fontFamily: serif, fontSize: 22, fontWeight: 600, color: ink, margin: 0 }}>
            {p.supplierName}
          </Text>
          <Text style={{ fontSize: 16, color: ink, lineHeight: '24px' }}>
            {c.hello}
            <br />
            {p.isReminder
              ? c.reminder(p.number, p.total, p.dueDate)
              : c.invoice(p.number, p.total, p.dueDate)}{' '}
            {c.attached}
          </Text>
          {p.message ? (
            <Text style={{ fontSize: 15, color: ink, lineHeight: '22px', whiteSpace: 'pre-line' }}>
              {p.message}
            </Text>
          ) : null}
          <Button
            href={p.publicUrl}
            style={{
              backgroundColor: green,
              color: '#fff',
              borderRadius: 8,
              padding: '12px 20px',
              fontSize: 15,
              textDecoration: 'none',
            }}
          >
            {c.button}
          </Button>
          <Text style={{ fontSize: 12, color: muted, marginTop: 24 }}>
            {c.sentVia} {BRAND.name}.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
