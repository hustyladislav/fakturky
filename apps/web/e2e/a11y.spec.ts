import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'
import {
  addBankAccount,
  createContact,
  fillLines,
  ICO,
  onboardByIco,
  pickCustomer,
  signUp,
  testEmail,
} from './helpers'

/** WCAG 2.x A + AA over every page, in both themes. Violations are listed with their selectors. */
async function expectNoViolations(page: Page, label: string) {
  await page.waitForLoadState('networkidle')
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  const summary = violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.nodes
        .map((n) => n.target.join(' '))
        .slice(0, 4)
        .join(' | ')}`,
  )
  expect(summary, `${label}\n${summary.join('\n')}`).toEqual([])
}

const setTheme = async (page: Page, theme: 'light' | 'dark') => {
  await page.evaluate((t) => {
    localStorage.setItem('theme', t)
    document.documentElement.classList.toggle('dark', t === 'dark')
  }, theme)
}

const publicPages = ['/', '/prihlaseni', '/registrace', '/podminky', '/soukromi']

for (const theme of ['light', 'dark'] as const) {
  test(`a11y: public pages (${theme})`, async ({ page }) => {
    for (const path of publicPages) {
      await page.goto(path)
      await setTheme(page, theme)
      await expectNoViolations(page, `${path} ${theme}`)
    }
  })
}

test('a11y: signed-in pages, dialogs and the public invoice', async ({ page }) => {
  await signUp(page, testEmail('a11y'))
  await onboardByIco(page, ICO.payerSupplier, 'E2E Plátce s.r.o.')
  await addBankAccount(page)
  await createContact(page, 'A11y Odběratel s.r.o.', {
    ico: ICO.customer,
    dic: 'CZ12345024',
    street: 'Hlavní 1',
    city: 'Praha',
    zip: '11000',
  })
  await page.goto('/faktury/nova')
  await pickCustomer(page, 'A11y Odběratel s.r.o.')
  await fillLines(page, [{ description: 'Práce', quantity: '1', unitPrice: '1000', vatRate: '21' }])
  await page.getByRole('button', { name: 'Vystavit', exact: true }).click()
  await page.waitForURL(
    (u) => /^\/faktury\/[^/]+$/.test(u.pathname) && u.pathname !== '/faktury/nova',
  )
  const invoicePath = new URL(page.url()).pathname
  const publicUrl = await page.locator('a[href*="/f/"]').first().getAttribute('href')

  const pages = [
    '/prehled',
    '/faktury',
    '/faktury/nova',
    invoicePath,
    '/kontakty',
    '/nastaveni',
    '/sablony',
  ]
  for (const theme of ['light', 'dark'] as const) {
    for (const path of pages) {
      await page.goto(path)
      await setTheme(page, theme)
      await expectNoViolations(page, `${path} ${theme}`)
    }
    // Overlays: command palette and shortcuts help.
    await page.goto('/prehled')
    await setTheme(page, theme)
    await page.getByRole('button', { name: 'Hledat nebo spustit akci…' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expectNoViolations(page, `command palette ${theme}`)
    await page.keyboard.press('Escape')
    if (publicUrl) {
      await page.goto(publicUrl)
      await setTheme(page, theme)
      await expectNoViolations(page, `public invoice ${theme}`)
    }
  }
})
