import { expect, test } from '@playwright/test'

test('sign up, then create a contact', async ({ page }) => {
  const email = `e2e-${Date.now()}@example.com`
  await page.goto('/registrace')
  await page.getByLabel('Jméno a příjmení').fill('Test Uživatel')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Heslo').fill('e2e-password-123')
  await page.getByRole('button', { name: 'Vytvořit účet' }).click()
  await expect(page.getByRole('heading', { name: 'Přehled' })).toBeVisible()

  await page.goto('/kontakty')
  await page.getByRole('button', { name: 'Nový kontakt' }).click()
  await page.getByLabel('Název nebo jméno').fill('Acme s.r.o.')
  await page.getByRole('button', { name: 'Vytvořit' }).click()
  await expect(page.getByRole('cell', { name: 'Acme s.r.o.' })).toBeVisible()
})
