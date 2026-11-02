import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'
import { ICO, onboardByIco, signUp, testEmail } from './helpers'

const invoicesCsv = fileURLToPath(new URL('./fixtures/invoices.csv', import.meta.url))

test('CSV import: preview changes nothing, import keeps the original numbers and flags them', async ({
  page,
}) => {
  await signUp(page, testEmail('import'))
  await onboardByIco(page, ICO.nonPayerSupplier, 'E2E Neplátce Novák')

  await page.goto('/import')
  await page.waitForLoadState('networkidle')
  await page.getByLabel('Soubor', { exact: true }).setInputFiles(invoicesCsv)

  // Preview: reported, but nothing is stored.
  await page.getByRole('button', { name: 'Náhled (nic se neuloží)' }).last().click()
  const result = page.getByRole('status')
  await expect(result).toContainText('Náhled importu')
  await expect(result).toContainText('Doklady: 2 nových')
  await page.goto('/faktury')
  await expect(page.getByText('2024-0001')).toHaveCount(0)

  // The real import.
  await page.goto('/import')
  await page.waitForLoadState('networkidle')
  await page.getByLabel('Soubor', { exact: true }).setInputFiles(invoicesCsv)
  await page.getByRole('button', { name: 'Importovat' }).last().click()
  await expect(page.getByRole('status')).toContainText('Import dokončen')
  await expect(page.getByRole('status')).toContainText('Doklady: 2 nových')

  await page.goto('/faktury')
  const row = page.getByRole('row').filter({ hasText: '2024-0001' })
  await expect(row).toContainText('Novák s.r.o.')
  await expect(row).toContainText('Zaplacená')
  await expect(page.getByRole('row').filter({ hasText: '2024-0002' })).toBeVisible()

  await row.getByText('2024-0001').click()
  await expect(page.getByText('importováno')).toBeVisible()

  // Idempotent: running it again skips everything.
  await page.goto('/import')
  await page.waitForLoadState('networkidle')
  await page.getByLabel('Soubor', { exact: true }).setInputFiles(invoicesCsv)
  await page.getByRole('button', { name: 'Importovat' }).last().click()
  await expect(page.getByRole('status')).toContainText('0 nových, 2 přeskočeno')
})
