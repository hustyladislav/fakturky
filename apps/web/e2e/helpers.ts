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
  await page.getByRole('button', { name: 'Vytvořit účet' }).click()
  await page.waitForURL(/\/onboarding$/)
}

/** Onboarding: look the supplier up by IČO (mock ARES) and save. */
export async function onboardByIco(page: Page, ico: string, expectedName: string) {
  await page.getByLabel('IČO').fill(ico)
  await page.getByRole('button', { name: 'Načíst z ARES' }).click()
  await expect(page.getByLabel('Obchodní jméno / jméno a příjmení')).toHaveValue(expectedName)
  await page.getByRole('button', { name: 'Pokračovat' }).click()
  await expect(page.getByRole('heading', { name: 'Dobrý den' })).toBeVisible()
}

export async function addBankAccount(page: Page) {
  await page.goto('/nastaveni')
  await page.getByRole('button', { name: 'Přidat účet' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Název účtu').fill('Provozní účet')
  await dialog.getByLabel('Číslo účtu nebo IBAN').fill('19-2000145399/0800')
  await dialog.getByRole('button', { name: 'Vytvořit' }).click()
  // Czech number -> IBAN is derived and shown (DOMAIN.md test vector).
  await expect(page.getByText('CZ6508000000192000145399')).toBeVisible()
}

export async function createContact(page: Page, name: string) {
  await page.goto('/kontakty')
  await page.getByRole('button', { name: 'Nový kontakt' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Název nebo jméno').fill(name)
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
  await page.getByLabel('Odběratel', { exact: true }).fill(name)
  await page.getByRole('button', { name }).first().click()
}
