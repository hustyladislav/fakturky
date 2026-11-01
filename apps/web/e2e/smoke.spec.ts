import { expect, test } from '@playwright/test'

test('anonymous visitors are sent to the Czech sign-in page', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/prihlaseni/)
})
