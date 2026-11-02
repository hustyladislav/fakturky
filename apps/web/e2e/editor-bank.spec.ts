import { expect, test } from '@playwright/test'
import {
  createContact,
  fillLines,
  ICO,
  onboardByIco,
  pickCustomer,
  signUp,
  testEmail,
} from './helpers'

const issuedUrl = (u: URL) =>
  /^\/faktury\/[^/]+$/.test(u.pathname) && u.pathname !== '/faktury/nova'

test('no bank account: inline mini-form in Platba, one-line confirm on Vystavit, then issue', async ({
  page,
}) => {
  await signUp(page, testEmail('ed-nobank'))
  await onboardByIco(page, ICO.nonPayerSupplier, 'E2E Neplátce Novák')
  await createContact(page, 'Bez Účtu Odběratel')
  await page.goto('/faktury/nova')
  await page.waitForLoadState('networkidle')
  await pickCustomer(page, 'Bez Účtu Odběratel')
  await fillLines(page, [{ description: 'Služba', quantity: '1', unitPrice: '1000' }])

  // Platba shows the mini-form instead of an empty select.
  await expect(
    page.getByText('Přidejte účet, ať faktura ponese číslo účtu a QR platbu.'),
  ).toBeVisible()
  await expect(page.getByLabel('Bankovní účet', { exact: true })).toHaveCount(0)

  // First ⌘↵ asks; nothing is issued yet.
  await page.keyboard.press('Control+Enter')
  const confirm = page
    .getByRole('alert')
    .filter({ hasText: 'Faktura nebude mít QR platbu ani číslo účtu — pokračovat?' })
  await expect(confirm).toBeVisible()
  await expect(page).toHaveURL(/\/faktury\/nova$/)
  await confirm.getByRole('button', { name: 'Zrušit' }).click()
  await expect(confirm).toHaveCount(0)

  // Adding the account inline removes the warning for good.
  const account = page.getByLabel('Číslo účtu nebo IBAN')
  await account.fill('19-2000145399/0800')
  await account.press('Enter')
  await expect(page.getByLabel('Bankovní účet', { exact: true })).toBeVisible()
  await page.keyboard.press('Control+Enter')
  await page.waitForURL(issuedUrl)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^\d{4}-\d{4}$/)
})

test('"Vystavit i tak" issues without a bank account', async ({ page }) => {
  await signUp(page, testEmail('ed-nobank2'))
  await onboardByIco(page, ICO.nonPayerSupplier, 'E2E Neplátce Novák')
  await createContact(page, 'Bez Účtu Dva')
  await page.goto('/faktury/nova')
  await page.waitForLoadState('networkidle')
  await pickCustomer(page, 'Bez Účtu Dva')
  await fillLines(page, [{ description: 'Služba', quantity: '1', unitPrice: '500' }])
  await page.getByRole('button', { name: 'Vystavit', exact: true }).click()
  await page.getByRole('button', { name: 'Vystavit i tak' }).click()
  await page.waitForURL(issuedUrl)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^\d{4}-\d{4}$/)
})
