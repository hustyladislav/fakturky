import { expect, test } from '@playwright/test'
import {
  addBankAccount,
  createContact,
  fillLines,
  issueInvoice,
  onboardManually,
  signUp,
  testEmail,
} from './helpers'

test('registry banner can be dismissed for good; "Neuložené změny" does not move the form; tab title carries the number', async ({
  page,
}) => {
  await signUp(page, testEmail('ed-polish'))
  await page.waitForLoadState('networkidle')
  await onboardManually(page, 'Polish Test')
  await page.getByRole('button', { name: 'Přeskočit' }).click()
  await page.getByRole('button', { name: 'Přejít na přehled' }).click()
  await addBankAccount(page)
  await createContact(page, 'Polish Odběratel')

  await page.goto('/faktury/nova')
  await page.waitForLoadState('networkidle')
  await expect(page).toHaveTitle('Nová faktura · Fakturky')

  const banner = page.getByText('V nastavení chybí zápis v rejstříku')
  await expect(banner).toBeVisible()
  const sheet = page.getByRole('region', { name: 'Doklad' })
  // Document-relative top, so scrolling while typing does not count as a shift.
  const top = () => sheet.evaluate((el) => el.getBoundingClientRect().top + window.scrollY)
  const before = await top()
  await fillLines(page, [{ description: 'Služba', quantity: '1', unitPrice: '100' }])
  await expect(page.getByText('Neuložené změny').first()).toBeVisible()
  expect(await top()).toBe(before)

  await page.getByRole('button', { name: 'Skrýt upozornění' }).click()
  await expect(banner).toBeHidden()
  await page.reload()
  await page.waitForLoadState('networkidle')
  await expect(page.getByRole('heading', { name: 'Nová faktura' })).toBeVisible()
  await expect(banner).toBeHidden()

  await issueInvoice(page, 'Polish Odběratel')
  await expect(page).toHaveTitle(/^\d{4}-\d{4} · Fakturky$/)
})
