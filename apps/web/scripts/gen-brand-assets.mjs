// Generates favicon / app icons / OG image from BRAND.name. Run: pnpm --filter @fakturky/web gen:brand

import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from '@playwright/test'
import { BRAND } from '../../../packages/core/src/brand.ts'

const here = dirname(fileURLToPath(import.meta.url))
const pub = resolve(here, '../public')
const require = createRequire(resolve(here, '../../../packages/ui/package.json'))
const fontFile = (pkg, f) =>
  pathToFileURL(
    resolve(dirname(require.resolve(`@fontsource-variable/${pkg}/package.json`)), 'files', f),
  ).href

const geistSerif = pathToFileURL(
  resolve(
    here,
    '../../../packages/ui/node_modules/geist/dist/fonts/geist-serif/GeistSerif-Regular.woff2',
  ),
).href

const letter = BRAND.name.charAt(0).toUpperCase()
const fonts = `
@font-face{font-family:F;src:url(${geistSerif});font-weight:400}
@font-face{font-family:Inter9;src:url(${fontFile('inter', 'inter-latin-ext-wght-normal.woff2')});font-weight:100 900;unicode-range:U+0100-02BA,U+1E00-1EFF,U+20A0-20C0}
@font-face{font-family:Inter9;src:url(${fontFile('inter', 'inter-latin-wght-normal.woff2')});font-weight:100 900;unicode-range:U+0000-00FF,U+2000-206F}`

const mark = (size) => `
<div style="width:${size}px;height:${size}px;border-radius:${size * 0.25}px;background:#1F4D3C;position:relative;overflow:hidden">
  <span style="position:absolute;left:${size * 0.265}px;top:${size * 0.06}px;font:400 ${size * 0.72}px/1 F;color:#F6F2EA">${letter}</span>
  <i style="position:absolute;left:${size * 0.7}px;top:${size * 0.6}px;width:${size * 0.13}px;height:${size * 0.13}px;border-radius:50%;background:rgba(246,242,234,.55)"></i>
</div>`

const browser = await chromium.launch()
async function shot(html, w, h, out, transparent = true) {
  const page = await browser.newPage({ viewport: { width: w, height: h } })
  const tmp = resolve(tmpdir(), `brand-${Date.now()}.html`)
  writeFileSync(tmp, `<meta charset="utf-8"><style>${fonts}html,body{margin:0}</style>${html}`)
  await page.goto(pathToFileURL(tmp).href)
  await page.evaluate(async () => {
    await Promise.all(
      ['400 20px F', '400 20px Inter9'].map((f) => document.fonts.load(f, 'Fakturyěž')),
    )
    await document.fonts.ready
  })
  await page.screenshot({ path: resolve(pub, out), omitBackground: transparent })
  await page.close()
}

await shot(mark(32), 32, 32, 'favicon-32.png')
await shot(mark(180), 180, 180, 'apple-touch-icon.png')
await shot(mark(192), 192, 192, 'icon-192.png')
await shot(mark(512), 512, 512, 'icon-512.png')
// Maskable: full-bleed brand colour, glyph inside the 80 % safe zone (platforms crop to circles/squircles).
await shot(
  `<div style="width:512px;height:512px;background:#1F4D3C;position:relative;overflow:hidden">
    <span style="position:absolute;left:150px;top:70px;font:400 330px/1 F;color:#F6F2EA">${letter}</span>
    <i style="position:absolute;left:348px;top:300px;width:46px;height:46px;border-radius:50%;background:rgba(246,242,234,.55)"></i>
  </div>`,
  512,
  512,
  'icon-maskable-512.png',
  false,
)
await shot(
  `<div style="width:1200px;height:630px;background:#F6F2EA;position:relative;font-family:Inter9;color:#1B1A17">
    <div style="position:absolute;left:96px;top:96px;display:flex;align-items:center;gap:22px">${mark(88)}<span style="font:400 56px F">${BRAND.name}</span></div>
    <div style="position:absolute;left:96px;top:270px;width:900px;font:400 76px/1.08 F;letter-spacing:-.005em">Fakturujte zdarma.<br>Bez omezení.</div>
    <div style="position:absolute;left:96px;top:500px;font:400 30px/1.4 Inter9;color:#6B665B">Faktury, QR platba, ARES a DPH pro české živnostníky a firmy.</div>
    <div style="position:absolute;left:0;right:0;bottom:0;height:12px;background:#1F4D3C"></div>
  </div>`,
  1200,
  630,
  'og.png',
  false,
)
await browser.close()

writeFileSync(
  resolve(pub, 'favicon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#1F4D3C"/><text x="8.5" y="23" font-family="Geist Serif,Georgia,serif" font-size="23" fill="#F6F2EA">${letter}</text><circle cx="24.5" cy="21.6" r="2.1" fill="#F6F2EA" fill-opacity=".55"/></svg>\n`,
)
writeFileSync(
  resolve(pub, 'site.webmanifest'),
  `${JSON.stringify(
    {
      name: BRAND.name,
      short_name: BRAND.name,
      lang: 'cs',
      id: '/',
      start_url: '/prehled',
      scope: '/',
      categories: ['business', 'finance', 'productivity'],
      description: BRAND.tagline,
      display: 'standalone',
      background_color: '#F6F2EA',
      theme_color: '#1F4D3C',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
      shortcuts: [
        {
          name: 'Nová faktura',
          url: '/faktury/nova',
          icons: [{ src: '/icon-192.png', sizes: '192x192' }],
        },
        { name: 'Faktury', url: '/faktury', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
      ],
    },
    null,
    2,
  )}\n`,
)

// Offline fallback page (served by the service worker): copy comes from the i18n catalog.
const offline = JSON.parse(readFileSync(resolve(here, '../src/i18n/offline.json'), 'utf8'))
writeFileSync(
  resolve(pub, 'offline.html'),
  `<!doctype html>
<html lang="cs">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    <title>${offline.title}</title>
    <style>
      body { margin: 0; min-height: 100svh; display: grid; place-items: center; padding: 24px; text-align: center;
        font: 16px/1.5 system-ui, sans-serif; background: #f6f2ea; color: #1b1a17; }
      @media (prefers-color-scheme: dark) { body { background: #121310; color: #eee9dd; } button { color: #8cc4a4; } p { color: #9c978a; } }
      h1 { font: 500 28px/1.2 Georgia, serif; margin: 0 0 8px; }
      p { margin: 0 0 16px; color: #6b665b; }
      button { font: inherit; padding: 10px 18px; border-radius: 8px; border: 1px solid currentColor; background: none; color: #1f4d3c; cursor: pointer; }
    </style>
  </head>
  <body>
    <main>
      <h1>${offline.title}</h1>
      <p>${offline.text}</p>
      <button type="button" onclick="location.reload()">${offline.retry}</button>
    </main>
  </body>
</html>
`,
)
