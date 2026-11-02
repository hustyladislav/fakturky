import { BRAND } from '@fakturky/core/brand'
import {
  Body,
  Button,
  Container,
  Font,
  Head,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'

// Same palette as docs/DESIGN.md (light theme); email clients get web-safe fonts.
const paper = '#F6F2EA'
const ink = '#1B1A17'
const muted = '#6B665B'
const green = '#1F4D3C'
// Geist Serif is served from the app's /fonts (clients without web-font support fall back to Georgia).
const serif = '"Geist Serif", Georgia, "Times New Roman", serif'
const serifFontUrl = `${BRAND.productionUrl}/fonts/GeistSerif-Regular.woff2`
const sans = '-apple-system, "Segoe UI", Helvetica, Arial, sans-serif'

export function MagicLinkEmail({ url }: { url: string }) {
  return (
    <Html lang="cs">
      <Head>
        <Font
          fontFamily="Geist Serif"
          fallbackFontFamily={['Georgia', 'Times New Roman', 'serif']}
          webFont={{ url: serifFontUrl, format: 'woff2' }}
          fontWeight={400}
          fontStyle="normal"
        />
      </Head>
      <Preview>{`Přihlášení do aplikace ${BRAND.name}`}</Preview>
      <Body style={{ backgroundColor: paper, margin: 0, padding: '32px 0', fontFamily: sans }}>
        <Container
          style={{
            maxWidth: 480,
            backgroundColor: '#FCFAF5',
            border: '1px solid #E2DACB',
            borderRadius: 12,
            padding: 32,
          }}
        >
          <Text style={{ fontFamily: serif, fontSize: 26, fontWeight: 400, color: ink, margin: 0 }}>
            {BRAND.name}.
          </Text>
          <Text style={{ fontSize: 16, color: ink, lineHeight: '24px' }}>
            Dobrý den, pro přihlášení do aplikace {BRAND.name} klikněte na tlačítko níže. Odkaz je
            platný 5 minut a lze ho použít jen jednou.
          </Text>
          <Section style={{ margin: '24px 0' }}>
            <Button
              href={url}
              style={{
                backgroundColor: green,
                color: paper,
                borderRadius: 8,
                padding: '12px 20px',
                fontSize: 15,
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Přihlásit se
            </Button>
          </Section>
          <Text style={{ fontSize: 13, color: muted, lineHeight: '20px' }}>
            Pokud tlačítko nefunguje, zkopírujte tento odkaz do prohlížeče: {url}
          </Text>
          <Text style={{ fontSize: 13, color: muted, lineHeight: '20px' }}>
            Pokud jste o přihlášení nežádali, můžete tento e-mail ignorovat.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
