import { expect, type Page } from '@playwright/test'

export const PASSWORD = 'e2e-password-123'

/** Mock-ARES fixtures (see ares-mock.mjs). */
export const ICO = {
  nonPayerSupplier: '12345008',
  payerSupplier: '12345016',
  customer: '12345024',
}

let counter = 0
/** Unique, obviously-fake account so repeated runs and journeys never collide. */
export function testEmail(tag: string): string {
  return `e2e-${tag}-${Date.now()}-${counter++}@example.com`
}

/** Matches a Czech amount regardless of which space character (space, NBSP, narrow NBSP) groups thousands. */
export const amountRe = (amount: string) => new RegExp(amount.replace(/ /g, '[\\s\\u00a0\\u202f]'))

export async function signUp(page: Page, email: string) {
  await page.goto('/registrace')
  await page.getByLabel('Jméno a příjmení').fill('E2E Tester')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Heslo').fill(PASSWORD)
  const submit = page.getByRole('button', { name: 'Vytvořit účet' })
  // The form is only safe to submit once hydrated (see fix in auth-form); also guards older builds.
  await expect(submit).toBeEnabled()
  await page.waitForLoadState('networkidle')
  await submit.click()
  await page.waitForURL(/\/onboarding$/)
}

/** Onboarding: look the supplier up by IČO (mock ARES; eight digits look themselves up) and save. */
export async function onboardByIco(page: Page, ico: string, expectedName: string) {
  await page.getByLabel('IČO').fill(ico)
  await expect(page.getByTestId('profile-summary')).toContainText(expectedName)
  await page.getByRole('button', { name: 'Pokračovat' }).click()
  await skipOnboardingBank(page)
}

/** Onboarding without an IČO: open the manual form, fill the name and save (no ARES). */
export async function onboardManually(page: Page, legalName: string) {
  await page.getByRole('button', { name: 'Nemám IČO / vyplnit ručně' }).click()
  await page.getByLabel('Obchodní jméno / jméno a příjmení').fill(legalName)
  await page.getByRole('button', { name: 'Pokračovat' }).click()
}

/** Onboarding bank step -> "Přeskočit" -> done screen -> dashboard. */
export async function skipOnboardingBank(page: Page) {
  await page.getByRole('button', { name: 'Přeskočit' }).click()
  await page.getByRole('button', { name: 'Přejít na přehled' }).click()
  await expect(page.getByRole('heading', { name: 'Dobrý den' })).toBeVisible()
}

export async function addBankAccount(page: Page) {
  await page.goto('/nastaveni')
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'Přidat účet' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Název účtu').fill('Provozní účet')
  await dialog.getByLabel('Číslo účtu nebo IBAN').fill('19-2000145399/0800')
  await dialog.getByRole('button', { name: 'Vytvořit' }).click()
  // Czech number -> IBAN is derived and shown (DOMAIN.md test vector).
  await expect(page.getByText('CZ6508000000192000145399')).toBeVisible()
}

export type ContactDetails = {
  ico?: string
  dic?: string
  street?: string
  city?: string
  zip?: string
}

export async function createContact(page: Page, name: string, d: ContactDetails = {}) {
  await page.goto('/kontakty')
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'Nový kontakt' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Název nebo jméno').fill(name)
  if (d.ico) await dialog.getByLabel('IČO').fill(d.ico)
  if (d.dic) await dialog.getByLabel('DIČ').fill(d.dic)
  if (d.street) await dialog.getByLabel('Ulice a číslo').fill(d.street)
  if (d.city) await dialog.getByLabel('Město').fill(d.city)
  if (d.zip) await dialog.getByLabel('PSČ').fill(d.zip)
  await dialog.getByRole('button', { name: 'Vytvořit' }).click()
  await expect(page.getByRole('cell', { name })).toBeVisible()
}

export type Line = { description: string; quantity: string; unitPrice: string; vatRate?: string }

/** Fills the (desktop) line rows of the invoice form, adding rows as needed. */
export async function fillLines(page: Page, lines: Line[]) {
  const field = (label: string, i: number) =>
    page.getByLabel(label, { exact: true }).locator('visible=true').nth(i)
  for (const [i, l] of lines.entries()) {
    if (i > 0) await page.getByRole('button', { name: 'Přidat položku' }).click()
    await field('Popis', i).fill(l.description)
    await field('Množství', i).fill(l.quantity)
    await field('Cena za MJ', i).fill(l.unitPrice)
    if (l.vatRate) await field('DPH', i).selectOption(l.vatRate)
  }
}

/** Selects an existing contact in the customer picker by name. */
export async function pickCustomer(page: Page, name: string) {
  const search = page.getByLabel('Odběratel', { exact: true })
  const match = page.getByRole('button', { name }).first()
  await page.waitForLoadState('networkidle')
  // The server-rendered input accepts text before hydration, which then resets it; re-type until the
  // suggestion list reacts so the helper never depends on hydration timing.
  await expect(async () => {
    await search.fill(name)
    await expect(match).toBeVisible({ timeout: 3_000 })
  }).toPass({ timeout: 20_000 })
  await match.click()
}

/** Creates and issues a one-line invoice for an existing contact (non-VAT-payer supplier); returns its document id. */
export async function issueInvoice(page: Page, customerName: string, unitPrice = '1000') {
  await page.goto('/faktury/nova')
  await page.waitForLoadState('networkidle')
  await pickCustomer(page, customerName)
  await fillLines(page, [{ description: 'Služba', quantity: '1', unitPrice }])
  await page.getByRole('button', { name: 'Vystavit', exact: true }).click()
  await page.waitForURL(
    (u) => /^\/faktury\/[^/]+$/.test(u.pathname) && u.pathname !== '/faktury/nova',
  )
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^\d{4}-\d{4}$/)
  return new URL(page.url()).pathname.split('/').pop() as string
}

/** Today in Europe/Prague as YYYY-MM-DD (the date the app uses for "today"). */
export const todayPrague = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Prague' }).format(new Date())

/** Invoice detail: run a secondary action from the "Více" menu (desktop layout; the mobile copy is hidden). */
export async function clickMoreAction(page: Page, name: string) {
  await page.getByRole('button', { name: 'Více', exact: true }).first().click()
  await page.getByRole('menuitem', { name }).click()
}
