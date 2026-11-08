import { expect, test } from '@playwright/test'
import { onboardManually, signUp, testEmail } from './helpers'

test.use({ viewport: { width: 390, height: 844 } })

test('phone editor: items right after the customer, dates folded into a summary row, no FAB or registry banner', async ({
  page,
}) => {
  await signUp(page, testEmail('ed-mobile'))
  await page.waitForLoadState('networkidle')
  // Manual profile without a registry note, so the banner would show on a desktop.
  await onboardManually(page, 'Mobilní Test')
  await page.getByRole('button', { name: 'Přeskočit' }).click()
  await page.getByRole('link', { name: 'Vystavit první fakturu' }).click()
  await page.waitForURL(/\/faktury\/nova$/)
  await page.waitForLoadState('networkidle')

  await expect(page.getByText('V nastavení chybí zápis v rejstříku')).toBeHidden()
  await expect(page.getByRole('link', { name: 'Nová faktura' })).toHaveCount(0)

  const desc = page.getByLabel('Popis', { exact: true })
  const customer = page.getByLabel('Odběratel', { exact: true })
  const summary = page.getByRole('button', { name: /Splatnost za 14 dní/ })
  await expect(summary).toBeVisible()
  await expect(page.getByLabel('Datum vystavení')).toBeHidden()

  const y = async (l: ReturnType<typeof page.locator>) => (await l.boundingBox())?.y ?? 0
  expect(await y(desc)).toBeGreaterThan(await y(customer))
  expect(await y(desc)).toBeLessThan(await y(summary))

  await summary.click()
  await expect(page.getByLabel('Datum vystavení')).toBeVisible()
  await expect(summary).toHaveAttribute('aria-expanded', 'true')

  // The action bar stays reachable.
  await expect(page.getByRole('button', { name: 'Vystavit', exact: true })).toBeInViewport()
})
