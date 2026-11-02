import { expect, test } from '@playwright/test'
import { addBankAccount, createContact, ICO, onboardByIco, signUp, testEmail } from './helpers'

// 1×1 PNG
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
  'base64',
)

test('logo and accent colour are stored privately and used in the PDF', async ({ page }) => {
  await signUp(page, testEmail('look'))
  await onboardByIco(page, ICO.nonPayerSupplier, 'E2E Neplátce Novák')
  await addBankAccount(page)
  await createContact(page, 'Vzhled s.r.o.')

  await page.goto('/nastaveni')
  await page.waitForLoadState('networkidle')
  await page
    .locator('#asset-logo')
    .setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: PNG })
  await expect(page.getByRole('img', { name: 'Logo' })).toBeVisible()
  await page.locator('#asset-signature').setInputFiles({
    name: 'bad.png',
    mimeType: 'image/png',
    buffer: Buffer.from('not an image at all, just text bytes'),
  })
  await expect(page.getByText('Podporujeme jen obrázky PNG a JPEG.')).toBeVisible()

  await page.goto('/faktury/nova')
  await page.waitForLoadState('networkidle')
  await page.getByLabel('Odběratel', { exact: true }).fill('Vzhled')
  await page.getByRole('button', { name: /Vzhled s\.r\.o\./ }).click()
  await page.getByLabel('Popis', { exact: true }).locator('visible=true').first().fill('Práce')
  await page.getByLabel('Cena za MJ', { exact: true }).locator('visible=true').first().fill('100')
  await page.getByRole('button', { name: 'Vystavit', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^\d{4}-0001$/)
  const id = new URL(page.url()).pathname.split('/').pop()
  const pdf = await page.request.get(`/api/documents/${id}/pdf`)
  expect(pdf.status()).toBe(200)
  expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-')
})

test('appearance: live preview follows the controls, one save model, dimmed paper in dark mode', async ({
  page,
}) => {
  await signUp(page, testEmail('look2'))
  await onboardByIco(page, ICO.nonPayerSupplier, 'E2E Neplátce Novák')
  await page.goto('/nastaveni')
  await page.waitForLoadState('networkidle')

  const preview = page.getByTestId('appearance-preview')
  await expect(preview).toBeVisible()
  await expect(page.getByText('Už vystavené doklady si zachovají původní vzhled.')).toBeVisible()
  const wrap = preview.locator('.fk-sheet-wrap')
  await expect(wrap).toHaveCSS('--fk-accent', '#1f4d3c')

  // The preview changes at once; the colour is saved by itself a moment later (no separate Uložit).
  await page.locator('#accent').fill('#c0392b')
  await expect(wrap).toHaveCSS('--fk-accent', '#c0392b')
  await expect(page.getByRole('status').filter({ hasText: 'Uloženo' })).toBeVisible()
  await page.reload()
  await page.waitForLoadState('networkidle')
  await expect(page.locator('#accent')).toHaveValue('#c0392b')
  await expect(
    page.locator('#vzhled').getByRole('button', { name: 'Uložit', exact: true }),
  ).toHaveCount(0)

  // Logo upload shows up in the preview and reports through the same status line.
  await page
    .locator('#asset-logo')
    .setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: PNG })
  await expect(preview.locator('img.fk-logo')).toHaveCount(1)

  // Dark UI: the paper is dimmed, not pure white (the PDF keeps its white).
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.evaluate(() => localStorage.setItem('theme', 'dark'))
  await page.reload()
  await page.waitForLoadState('networkidle')
  await expect(page.getByTestId('appearance-preview').locator('.fk-sheet')).toHaveCSS(
    'background-color',
    'rgb(244, 241, 234)',
  )
})
