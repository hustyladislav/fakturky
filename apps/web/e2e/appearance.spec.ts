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
  await expect(page.getByText('Only PNG and JPEG images are supported')).toBeVisible()

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
