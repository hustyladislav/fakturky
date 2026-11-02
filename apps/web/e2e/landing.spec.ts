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
