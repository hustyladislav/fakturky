import { expect, test } from '@playwright/test'
import { addBankAccount, createContact, ICO, onboardByIco, signUp, testEmail } from './helpers'

async function setup(page: import('@playwright/test').Page, tag: string) {
  await signUp(page, testEmail(tag))
  await onboardByIco(page, ICO.nonPayerSupplier, 'E2E Neplátce Novák')
  await addBankAccount(page)
  await page.goto('/prehled')
  await page.waitForLoadState('networkidle')
}

test('keyboard only: N, IČO, Enter, description, Tab to price, ⌘↵ issues (timed)', async ({
  page,
}) => {
  await setup(page, 'kbd-ico')

  // Everything below is keyboard input only: no click, no locator-driven fill.
  const started = Date.now()
  await page.keyboard.press('n')
  await expect(page.getByLabel('Odběratel', { exact: true })).toBeFocused()
  await page.keyboard.type(ICO.customer)
  // Enter right after typing: waits for the ARES answer, then creates and picks the contact.
  await page.keyboard.press('Enter')
  await expect(page.getByLabel('Popis')).toBeFocused()
  await page.keyboard.type('Konzultace')
  await page.keyboard.press('Tab') // množství (default 1)
  await page.keyboard.press('Tab') // MJ
  await page.keyboard.press('Tab') // cena
  await page.keyboard.type('1500')
  await page.keyboard.press('Control+Enter')
  await page.waitForURL(
    (u) => /^\/faktury\/[^/]+$/.test(u.pathname) && u.pathname !== '/faktury/nova',
  )
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^\d{4}-\d{4}$/)
  const ms = Date.now() - started
  console.log(`KEYBOARD_FLOW_MS=${ms}`)
  expect(ms).toBeLessThan(15_000)
})

test('keyboard only: arrows walk "Vaši odběratelé" then Enter picks; focus lands on the description', async ({
  page,
}) => {
  await setup(page, 'kbd-own')
  await createContact(page, 'Alfa Servis s.r.o.')
  await createContact(page, 'Alfa Stavby s.r.o.')
  await page.goto('/faktury/nova')
  await page.waitForLoadState('networkidle')

  await expect(page.getByLabel('Odběratel', { exact: true })).toBeFocused()
  await page.keyboard.type('alfa')
  await expect(page.getByRole('button', { name: /Alfa Servis/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Alfa Stavby/ })).toBeVisible()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowUp')
  await page.keyboard.press('Enter')

  await expect(page.getByLabel('Popis')).toBeFocused()
  // Contacts are listed alphabetically; ↓ ↓ ↑ from the first row lands on the second.
  await expect(page.getByText('Alfa Stavby s.r.o.').first()).toBeVisible()
})
