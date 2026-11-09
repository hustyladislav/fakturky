import { expect, type Page, test } from '@playwright/test'
import { ICO, onboardByIco, signUp, testEmail } from './helpers'

const link = (page: Page, href: string) => page.locator(`a[href="${href}"]`).first()

async function openDashboard(page: Page, tag: string) {
  await signUp(page, testEmail(tag))
  await onboardByIco(page, ICO.nonPayerSupplier, 'E2E Neplátce Novák')
  await page.goto('/prehled')
  await page.waitForLoadState('networkidle')
}

test('switching pages and hovering links does not ask the server who is signed in', async ({
  page,
}) => {
  await openDashboard(page, 'nav-cost')

  const sessionChecks: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/_serverFn/')) sessionChecks.push(request.url())
  })

  await link(page, '/faktury').click()
  await expect(page).toHaveURL(/\/faktury$/)
  await link(page, '/prehled').click()
  await expect(page).toHaveURL(/\/prehled$/)
  await link(page, '/kontakty').hover()
  // A hover preloads after a short delay; this asserts that nothing was sent.
  await page.waitForTimeout(500)

  expect(sessionChecks).toEqual([])
})

test('returning to a tab shows the account another tab switched to', async ({ page, context }) => {
  await openDashboard(page, 'nav-switch-a')

  await context.clearCookies()
  const other = await context.newPage()
  const newAccount = testEmail('nav-switch-b')
  await signUp(other, newAccount)
  await onboardByIco(other, ICO.nonPayerSupplier, 'E2E Neplátce Novák')

  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await link(page, '/faktury').click()

  await expect(page.getByText(newAccount).first()).toBeVisible()
})

test('a tab left open finds out on its next click that the session is gone', async ({
  page,
  context,
}) => {
  await page.clock.install()
  await openDashboard(page, 'nav-expired')

  await context.clearCookies()
  await page.clock.fastForward('06:00')
  await link(page, '/faktury').click()

  await expect(page).toHaveURL(/\/prihlaseni$/)
})
