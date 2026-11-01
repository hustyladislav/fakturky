// Tiny stand-in for the ARES REST API so e2e never talks to the real registry.
// The app's server-side lookup is pointed here via ARES_BASE_URL (see playwright.config.ts).
import { createServer } from 'node:http'

export const SUBJECTS = {
  // Sole trader, not a VAT payer.
  '12345008': {
    ico: '12345008',
    obchodniJmeno: 'E2E Neplátce Novák',
    pravniForma: '101',
    sidlo: { kodStatu: 'CZ', nazevObce: 'Brno', nazevUlice: 'Lipová', cisloDomovni: 12, psc: 60200 },
  },
  // s.r.o. registered for VAT.
  '12345016': {
    ico: '12345016',
    obchodniJmeno: 'E2E Plátce s.r.o.',
    dic: 'CZ12345016',
    pravniForma: '112',
    sidlo: { kodStatu: 'CZ', nazevObce: 'Praha', nazevUlice: 'Dlouhá', cisloDomovni: 5, cisloOrientacni: 2, psc: 11000 },
    seznamRegistraci: { stavZdrojeDph: 'AKTIVNI' },
  },
  // Customer.
  '12345024': {
    ico: '12345024',
    obchodniJmeno: 'E2E Odběratel a.s.',
    dic: 'CZ12345024',
    pravniForma: '121',
    sidlo: { kodStatu: 'CZ', nazevObce: 'Ostrava', nazevUlice: 'Hlavní', cisloDomovni: 7, psc: 70200 },
    seznamRegistraci: { stavZdrojeDph: 'AKTIVNI' },
  },
}

const port = Number(process.env.ARES_MOCK_PORT ?? 3199)

createServer((req, res) => {
  const ico = (req.url ?? '').split('?')[0].split('/').filter(Boolean).pop() ?? ''
  const subject = SUBJECTS[ico]
  res.setHeader('content-type', 'application/json')
  if (!subject) {
    res.statusCode = 404
    res.end(JSON.stringify({ kod: 'NENALEZENO', popis: 'Subjekt nenalezen' }))
    return
  }
  res.end(JSON.stringify(subject))
}).listen(port, '127.0.0.1', () => console.log(`ARES mock on :${port}`))
