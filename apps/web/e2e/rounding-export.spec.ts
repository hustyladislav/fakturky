import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import {
  addBankAccount,
  amountRe,
  createContact,
  ICO,
  onboardByIco,
  signUp,
  testEmail,
} from './helpers'

test('rounding line on an invoice and the full JSON export', async ({ page }) => {
  await signUp(page, testEmail('round'))
  await onboardByIco(page, ICO.nonPayerSupplier, 'E2E Neplátce Novák')
  await addBankAccount(page)
  await createContact(page, 'Zaokrouhlení s.r.o.')

  await page.goto('/faktury/nova')
  await page.waitForLoadState('networkidle')
  await page.getByLabel('Odběratel', { exact: true }).fill('Zaokrouhlení')
  await page.getByRole('button', { name: /Zaokrouhlení s\.r\.o\./ }).click()
  await page.getByLabel('Popis', { exact: true }).locator('visible=true').first().fill('Služba')
  await page
    .getByLabel('Cena za MJ', { exact: true })
    .locator('visible=true')
    .first()
    .fill('100.40')
  await page.getByLabel('Zaokrouhlit celkovou částku', { exact: false }).check()
  const total = page.getByText('Celkem k úhradě').locator('..')
  await expect(total).toContainText(amountRe('100,00'))
  await expect(page.getByText('Zaokrouhlení', { exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Vystavit', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^\d{4}-0001$/)
  await expect(page.getByText('Zaokrouhlení', { exact: true }).first()).toBeVisible()

  await page.goto('/nastaveni')
  await page.waitForLoadState('networkidle')
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Stáhnout všechna data (JSON)' }).click(),
  ])
  const data = JSON.parse(readFileSync(await download.path(), 'utf8'))
  expect(data.format).toBe('fakturky-export/1')
  expect(data.documents).toHaveLength(1)
  expect(data.documents[0].roundTotal).toBe(true)
  expect(data.contacts[0].name).toBe('Zaokrouhlení s.r.o.')
  expect(JSON.stringify(data)).not.toContain('publicToken')
})
