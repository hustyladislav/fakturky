// PR evidence: full-page screenshots of every screen, flagging horizontal overflow.
// Usage: BASE=http://localhost:<port> pnpm shots <outDir> [name,filter] [1440,390] [light,dark]
import { mkdirSync } from 'node:fs'
import { chromium } from '@playwright/test'

const [out, filter = '', widths = '1440,390', themes = 'light,dark'] = process.argv.slice(2)
if (!out) throw new Error('Usage: pnpm shots <outDir> [filter] [widths] [themes]')
const base = process.env.BASE ?? 'http://localhost:3000'
mkdirSync(out, { recursive: true })
const browser = await chromium.launch()
const ctx0 = await browser.newContext({
  baseURL: base,
  locale: 'cs-CZ',
  timezoneId: 'Europe/Prague',
})
const res = await ctx0.request.post('/api/auth/sign-in/email', {
  headers: { origin: base },
  data: { email: 'demo@example.cz', password: 'demo-heslo-123' },
})
if (!res.ok()) throw new Error('login failed ' + res.status())
const state = await ctx0.storageState()
const p0 = await ctx0.newPage()
await p0.goto('/faktury')
await p0.waitForTimeout(4000)
const hrefs = await p0.$$eval('a[href*="/faktury/"]', (a) => a.map((e) => e.getAttribute('href')))
const inv = hrefs.find((h) => /\/faktury\/[^/]+$/.test(h) && !h.endsWith('/nova'))
if (!inv) throw new Error('no invoice link; hrefs=' + JSON.stringify(hrefs.slice(0, 10)))
await ctx0.close()
const pub = ['/', '/prihlaseni', '/registrace']
const app = [
  '/prehled',
  '/faktury',
  inv,
  '/faktury/nova',
  '/kontakty',
  '/banka',
  '/dph',
  '/sablony',
  '/nastaveni',
  '/onboarding',
]
const name = (r) =>
  r === '/'
    ? 'landing'
    : r
        .replace(/\//g, '_')
        .replace(/^_/, '')
        .replace(/faktury_[0-9a-zA-Z_-]{8,}/, 'detail')
for (const w of widths.split(',').map(Number))
  for (const theme of themes.split(',')) {
    const ctx = await browser.newContext({
      baseURL: base,
      locale: 'cs-CZ',
      timezoneId: 'Europe/Prague',
      colorScheme: theme,
      viewport: { width: w, height: w < 600 ? 844 : 900 },
      deviceScaleFactor: w < 600 ? 2 : 1,
      hasTouch: w < 600,
      isMobile: w < 600,
    })
    await ctx.addInitScript((t) => {
      try {
        localStorage.setItem('theme', t)
      } catch {}
    }, theme)
    const p = await ctx.newPage()
    for (const r of [...pub, ...app]) {
      if (r === app[0]) await ctx.addCookies(state.cookies)
      if (filter && !filter.split(',').some((f) => name(r).includes(f))) continue
      await p.goto(r, { waitUntil: 'load' })
      await p.waitForTimeout(1500)
      const m = await p.evaluate(() => ({
        sw: document.documentElement.scrollWidth,
        cw: document.documentElement.clientWidth,
      }))
      await p.screenshot({ path: `${out}/${name(r)}-${w}-${theme}.png`, fullPage: true })
      console.log(name(r), w, theme, m.sw > m.cw ? `OVERFLOW ${m.sw}>${m.cw}` : 'ok')
    }
    await ctx.close()
  }
await browser.close()
