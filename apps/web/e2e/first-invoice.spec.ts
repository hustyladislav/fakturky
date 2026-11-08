import { expect, test } from '@playwright/test'
import { ICO, PASSWORD, testEmail } from './helpers'

test('sign-up to first issued invoice with the keyboard only, timed', async ({ page }) => {
  await page.goto('/registrace')
  await page.waitForLoadState('networkidle')
  await page.getByLabel('Jméno a příjmení').focus()

  // Clock starts at the first keystroke on the sign-up form.
  const started = Date.now()
  await page.keyboard.type('E2E Tester')
  await page.keyboard.press('Tab')
  await page.keyboard.type(testEmail('first'))
  await page.keyboard.press('Tab')
  await page.keyboard.type(PASSWORD)
  await page.keyboard.press('Enter')

  // Onboarding: IČO fills everything from ARES by itself.
  await page.waitForURL(/\/onboarding$/)
  await page.getByLabel('IČO').focus()
  await page.keyboard.type(ICO.nonPayerSupplier)
  await expect(page.getByTestId('profile-summary')).toContainText('E2E Neplátce Novák')
  await expect(page.getByRole('button', { name: 'Pokračovat' })).toBeFocused()
  await page.keyboard.press('Enter') // submits the form

  // Bank step: the field is focused.
  await expect(page.getByLabel('Číslo účtu nebo IBAN')).toBeFocused()
  await page.keyboard.type('19-2000145399/0800')
  await page.keyboard.press('Enter')

  // Done step: "Vystavit první fakturu" is focused.
  await expect(page.getByRole('link', { name: 'Vystavit první fakturu' })).toBeFocused()
  await page.keyboard.press('Enter')

  // Editor.
  await expect(page.getByLabel('Odběratel', { exact: true })).toBeFocused()
  await page.keyboard.type(ICO.customer)
  await page.keyboard.press('Enter')
  await expect(page.getByLabel('Popis')).toBeFocused()
  await page.keyboard.type('Konzultace')
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  await page.keyboard.type('1500')
  await page.keyboard.press('Control+Enter')
  await page.waitForURL(
    (u) => /^\/faktury\/[^/]+$/.test(u.pathname) && u.pathname !== '/faktury/nova',
  )
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^\d{4}-\d{4}$/)

  const seconds = (Date.now() - started) / 1000
  console.log(`FIRST_INVOICE_SECONDS=${seconds.toFixed(1)}`)
  expect(seconds).toBeLessThan(45)
})
