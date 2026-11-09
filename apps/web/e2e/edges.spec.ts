import { expect, test } from '@playwright/test'
import {
  addBankAccount,
  clickMoreAction,
  createContact,
  ICO,
  issueInvoice,
  onboardByIco,
  PASSWORD,
  signUp,
  skipOnboardingBank,
  testEmail,
} from './helpers'

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

  // The manual path keeps what was typed and still works.
  await page.getByRole('button', { name: 'Nemám IČO / vyplnit ručně' }).click()
  await expect(page.getByLabel('IČO')).toHaveValue('27082440')
  await page.getByLabel('Obchodní jméno / jméno a příjmení').fill('Ruční Zadání')
  await page.getByRole('button', { name: 'Pokračovat' }).click()
  await skipOnboardingBank(page)

  // Sections are deep-linkable and the sub-navigation follows the anchor.
  await page.goto('/nastaveni#banka')
  await page.waitForLoadState('networkidle')
  const subnav = page.getByRole('navigation', { name: 'Sekce nastavení' })
  await expect(subnav.getByRole('link', { name: 'Bankovní účty' })).toHaveAttribute(
    'aria-current',
    'location',
  )
  await expect(page.getByRole('heading', { name: 'Bankovní účty' })).toBeInViewport()
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
  await clickMoreAction(page, 'Duplikovat')
  await expect(page.getByRole('heading', { name: 'Upravit koncept' })).toBeVisible()

  // Cancel the original; the confirmation dialog is accepted.
  await page.goto('/faktury')
  await page.getByRole('link', { name: /-0001/ }).first().click()
  await clickMoreAction(page, 'Stornovat')
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

test('a contact never reads as fully paid while its figures failed to load', async ({ page }) => {
  await signUp(page, testEmail('contact-stats'))
  await onboardByIco(page, ICO.nonPayerSupplier, 'E2E Neplátce Novák')
  await createContact(page, 'Statistiky s.r.o.')
  await page.goto('/kontakty')
  await page.waitForLoadState('networkidle')
  await page.route(/contacts\/stats/, (route) => route.abort())
  await page.getByText('Statistiky s.r.o.').locator('visible=true').first().click()
  await expect(page.getByRole('heading', { name: 'Statistiky s.r.o.' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Zkusit znovu' })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('Vše zaplaceno')).toHaveCount(0)
})

test('a page that fails to load offers a Czech retry, not a raw error', async ({ page }) => {
  await signUp(page, testEmail('contact-list'))
  await onboardByIco(page, ICO.nonPayerSupplier, 'E2E Neplátce Novák')
  await createContact(page, 'Seznam s.r.o.')
  await page.route(/contacts\/list/, (route) => route.abort())
  await page.goto('/prehled')
  await page.waitForLoadState('networkidle')
  await page.getByRole('link', { name: 'Kontakty' }).locator('visible=true').first().click()
  const retry = page.getByRole('button', { name: 'Zkusit znovu' })
  await expect(retry).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('Something went wrong')).toHaveCount(0)
  await expect(page.getByText('Failed to fetch')).toHaveCount(0)

  await page.unroute(/contacts\/list/)
  await retry.click()
  await expect(page.getByText('Seznam s.r.o.').locator('visible=true').first()).toBeVisible()
})

test('an action that fails says so in Czech instead of doing nothing', async ({ page }) => {
  await signUp(page, testEmail('silent-failure'))
  await onboardByIco(page, ICO.nonPayerSupplier, 'E2E Neplátce Novák')
  await addBankAccount(page)
  await page.route(/bankAccounts\/delete/, (route) => route.abort())
  await page.getByRole('button', { name: 'Smazat' }).first().click()
  await expect(page.getByText('Něco se pokazilo. Zkuste to prosím znovu.')).toBeVisible()
  await expect(page.getByText('Failed to fetch')).toHaveCount(0)
  await expect(page.getByText('CZ6508000000192000145399')).toBeVisible()
})

test('bulk mark paid reports failures, keeps the selection and can be retried', async ({
  page,
}) => {
  await signUp(page, testEmail('bulk-fail'))
  await onboardByIco(page, ICO.nonPayerSupplier, 'E2E Neplátce Novák')
  await addBankAccount(page)
  await createContact(page, 'Hromadně s.r.o.')
  await issueInvoice(page, 'Hromadně s.r.o.')
  await issueInvoice(page, 'Hromadně s.r.o.')
  await page.goto('/faktury')
  await page.waitForLoadState('networkidle')
  await page.getByRole('checkbox', { name: 'Vybrat všechny' }).click()
  const bar = page.getByRole('toolbar', { name: 'Vybráno: 2' })
  const markPaid = bar.getByRole('button', { name: /Označit jako zaplacené/ })

  await page.route(/documents\/markPaid/, (route) => route.abort())
  await markPaid.click()
  await expect(page.getByText('Označeno jako zaplacené: 0, nepodařilo se: 2.')).toBeVisible()
  await expect(bar).toBeVisible()

  await page.unroute(/documents\/markPaid/)
  let calls = 0
  await page.route(/documents\/markPaid/, (route) =>
    calls++ === 0 ? route.abort() : route.continue(),
  )
  await markPaid.click()
  const partial = page
    .locator('[data-sonner-toast]')
    .filter({ hasText: 'Označeno jako zaplacené: 1, nepodařilo se: 1.' })
  await expect(partial).toBeVisible()
  await expect(partial.getByRole('button', { name: 'Vrátit' })).toBeVisible()
  await expect(bar).toHaveCount(0)
})

test('the bank search box follows the URL and never writes an old term back', async ({ page }) => {
  await signUp(page, testEmail('bank-search'))
  await onboardByIco(page, ICO.nonPayerSupplier, 'E2E Neplátce Novák')
  await addBankAccount(page)
  await page.goto('/banka')
  await page.waitForLoadState('networkidle')
  const search = page.getByPlaceholder('Hledat podle názvu, zprávy nebo symbolu')
  await search.fill('nájem')
  await expect(page).toHaveURL(/q=n%C3%A1jem/)

  await page.getByRole('link', { name: 'Přehled' }).locator('visible=true').first().click()
  await expect(page).toHaveURL(/\/prehled/)
  await page.goBack()
  await expect(page).toHaveURL(/q=n%C3%A1jem/)
  await expect(search).toHaveValue('nájem')

  await page.getByRole('link', { name: 'Banka' }).locator('visible=true').first().click()
  await expect(page).not.toHaveURL(/q=/)
  await expect(search).toHaveValue('')
  await page.waitForTimeout(500)
  await expect(page).not.toHaveURL(/q=/)
})
