import { BRAND } from '@fakturky/core/brand'
import { Body, Button, Container, Head, Html, Preview, Text } from '@react-email/components'

const paper = '#F6F2EA'
const ink = '#1B1A17'
const muted = '#6B665B'
const green = '#1F4D3C'
const serif = 'Georgia, "Times New Roman", serif'
const sans = '-apple-system, "Segoe UI", Helvetica, Arial, sans-serif'

export type InvoiceEmailProps = {
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
  return (
    <Html lang="cs">
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
            Dobrý den,
            <br />
            {p.isReminder
              ? `dovolujeme si vás upozornit, že faktura ${p.number} na částku ${p.total} je po splatnosti (splatnost ${p.dueDate}).`
              : `posíláme vám fakturu ${p.number} na částku ${p.total} se splatností ${p.dueDate}.`}{' '}
            PDF najdete v příloze, fakturu si můžete také otevřít online.
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
            Zobrazit fakturu
          </Button>
          <Text style={{ fontSize: 12, color: muted, marginTop: 24 }}>
            Odesláno přes {BRAND.name}.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
