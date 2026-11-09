import { expect, test } from '@playwright/test'

test('landing demo fills the supplier and the invoice preview from ARES', async ({ page }) => {
  await page.goto('/')
  // Typing into the server-rendered input before hydration would be reset.
  await page.waitForLoadState('networkidle')
  const ico = page.getByLabel('IČO', { exact: true })
  await expect(ico).toBeEnabled()

  await ico.fill('12345678')
  await page.getByRole('button', { name: 'Doplnit z ARES' }).click()
  await expect(page.getByText('Zkontrolujte IČO')).toBeVisible()

  await ico.fill('12345016')
  const card = page.getByTestId('demo-supplier')
  await expect(card).toContainText('E2E Plátce s.r.o.')
  await expect(card).toContainText('Plátce DPH')
  await expect(page.locator('#demo')).toContainText('Dlouhá')
})

test('comparison table names its sources', async ({ page }) => {
  await page.goto('/')
  const table = page.getByRole('table', { name: 'Porovnání bezplatných tarifů' })
  await expect(table.getByRole('row', { name: /Odběratelé a kontakty/ })).toContainText('Do 5')
  await expect(page.getByRole('link', { name: 'Fakturoid', exact: true })).toHaveAttribute(
    'href',
    'https://www.fakturoid.cz/cenik',
  )
})

test('hero figures do not overlap on a tablet', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 })
  await page.goto('/')
  const month = await page.getByText('148 500').boundingBox()
  const received = await page.getByText('112 300').boundingBox()
  if (!month || !received) throw new Error('hero figures not rendered')
  const apart =
    month.x + month.width <= received.x ||
    received.x + received.width <= month.x ||
    month.y + month.height <= received.y ||
    received.y + received.height <= month.y
  expect(apart).toBe(true)
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 320, height: 700 }, hasTouch: true, isMobile: true })

  test('the header offers sign-in without overflowing', async ({ page }) => {
    await page.goto('/')
    const signIn = page.getByRole('banner').getByRole('link', { name: 'Přihlásit se' })
    await expect(signIn).toBeInViewport()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
  })

  test('an anchor jump keeps the heading clear of the sticky header', async ({ page }) => {
    await page.goto('/#srovnani')
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => document.getElementById('srovnani')?.scrollIntoView())
    const header = await page.getByRole('banner').boundingBox()
    const heading = await page.locator('#srovnani h2').boundingBox()
    if (!header || !heading) throw new Error('header or heading missing')
    expect(heading.y).toBeGreaterThanOrEqual(header.y + header.height + 24)
  })
})
