import { expect, test } from '@playwright/test'
import { addBankAccount, ICO, onboardByIco, PASSWORD, signUp, testEmail } from './helpers'

test('anonymous visitors are sent to the login page', async ({ page }) => {
  await page.goto('/faktury')
  await expect(page).toHaveURL(/\/prihlaseni$/)
  await expect(page.getByText('Přihlášení', { exact: true })).toBeVisible()
})

test('wrong password shows a Czech error, correct password signs in again', async ({
  page,
  context,
}) => {
  const email = testEmail('auth')
  await signUp(page, email)
  await onboardByIco(page, ICO.nonPayerSupplier, 'E2E Neplátce Novák')

  await context.clearCookies()
  await page.goto('/prihlaseni')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Heslo').fill('totally-wrong-password')
  await expect(page.getByRole('button', { name: 'Přihlásit se', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Přihlásit se', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText('Nesprávný e-mail nebo heslo.')

  await page.getByLabel('Heslo').fill(PASSWORD)
  await page.getByRole('button', { name: 'Přihlásit se', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Dobrý den' })).toBeVisible()
})

test('unknown IČO and invalid bank account are rejected with helpful copy', async ({ page }) => {
  await signUp(page, testEmail('neg'))

  // Valid checksum but not in the (mock) registry -> 404 -> friendly message.
  await page.getByLabel('IČO').fill('27082440')
  await page.getByRole('button', { name: 'Načíst z ARES' }).click()
  await expect(page.getByText('IČO se nepodařilo najít v ARES. Vyplňte údaje ručně.')).toBeVisible()

  // Manual fallback still works.
  await page.getByLabel('Obchodní jméno / jméno a příjmení').fill('Ruční Zadání')
  await page.getByRole('button', { name: 'Pokračovat' }).click()
  await expect(page.getByRole('heading', { name: 'Dobrý den' })).toBeVisible()

  await page.goto('/nastaveni')

  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'Přidat účet' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Název účtu').fill('Špatný účet')
  await dialog.getByLabel('Číslo účtu nebo IBAN').fill('123456789/0800')
  await dialog.getByRole('button', { name: 'Vytvořit' }).click()
  await expect(
    page.getByText('Číslo účtu nebo IBAN není platné. Zkontrolujte ho prosím.'),
  ).toBeVisible()
})

test('an invalid public link shows the not-found copy, not a stack trace', async ({ page }) => {
  await page.goto('/f/this-token-does-not-exist')
  await expect(page.getByText('Tento odkaz na fakturu neplatí nebo byl zrušen.')).toBeVisible()
})

test('issued invoice can be duplicated into a draft and cancelled (number stays taken)', async ({
  page,
}) => {
  await signUp(page, testEmail('life'))
  await onboardByIco(page, ICO.nonPayerSupplier, 'E2E Neplátce Novák')
  await addBankAccount(page)

  await page.goto('/kontakty')

  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'Nový kontakt' }).click()
  await page.getByRole('dialog').getByLabel('Název nebo jméno').fill('Životní cyklus s.r.o.')
  await page.getByRole('dialog').getByRole('button', { name: 'Vytvořit' }).click()
  await expect(page.getByRole('cell', { name: 'Životní cyklus s.r.o.' })).toBeVisible()

  await page.goto('/faktury/nova')

  await page.waitForLoadState('networkidle')
  await page.getByLabel('Odběratel', { exact: true }).fill('Životní')
  await page.getByRole('button', { name: /Životní cyklus/ }).click()
  await page.getByLabel('Popis', { exact: true }).locator('visible=true').first().fill('Práce')
  await page.getByLabel('Cena za MJ', { exact: true }).locator('visible=true').first().fill('100')
  await page.getByRole('button', { name: 'Vystavit', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^\d{4}-0001$/)

  // Duplicate -> new draft without a number.
  await page.getByRole('button', { name: 'Duplikovat' }).first().click()
  await expect(page.getByRole('heading', { name: 'Upravit koncept' })).toBeVisible()

  // Cancel the original; the confirmation dialog is accepted.
  await page.goto('/faktury')
  await page.getByRole('link', { name: /-0001/ }).first().click()
  await page.getByRole('button', { name: 'Stornovat' }).first().click()
  await page.getByRole('dialog').getByRole('button', { name: 'Stornovat' }).click()
  await expect(page.getByText('Stornovaná', { exact: true }).first()).toBeVisible()

  // The cancelled number stays taken: the next invoice must get -0002, not reuse -0001.
  await page.goto('/faktury/nova')
  await page.waitForLoadState('networkidle')
  await page.getByLabel('Odběratel', { exact: true }).fill('Životní')
  await page.getByRole('button', { name: /Životní cyklus/ }).click()
  await page
    .getByLabel('Popis', { exact: true })
    .locator('visible=true')
    .first()
    .fill('Další práce')
  await page.getByLabel('Cena za MJ', { exact: true }).locator('visible=true').first().fill('50')
  await page.getByRole('button', { name: 'Vystavit', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^\d{4}-0002$/)
})
