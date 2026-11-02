import { expect, test } from '@playwright/test'
import { ICO, signUp, skipOnboardingBank, testEmail } from './helpers'

test('onboarding bank step: Czech number shows IBAN and BIC live, Enter saves and the first-invoice button is focused', async ({
  page,
}) => {
  await signUp(page, testEmail('onb-bank'))
  await page.waitForLoadState('networkidle')
  await page.getByLabel('IČO').fill(ICO.nonPayerSupplier)
  await page.getByRole('button', { name: 'Načíst z ARES' }).click()
  await expect(page.getByLabel('Obchodní jméno / jméno a příjmení')).toHaveValue(
    'E2E Neplátce Novák',
  )
  await page.getByRole('button', { name: 'Pokračovat' }).click()

  const account = page.getByLabel('Číslo účtu nebo IBAN')
  await expect(account).toBeFocused()
  await account.fill('19-2000145399/0800')
  await expect(page.getByTestId('account-derived')).toContainText('CZ65 0800 0000 1920 0014 5399')
  await expect(page.getByTestId('account-derived')).toContainText('BIC GIBACZPX')
  await account.press('Enter')

  await expect(page.getByRole('heading', { name: 'Máte hotovo' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Vystavit první fakturu' })).toBeFocused()
})

test('onboarding bank step can be skipped; the dashboard then offers "Přidat bankovní účet"', async ({
  page,
}) => {
  await signUp(page, testEmail('onb-skip'))
  await page.waitForLoadState('networkidle')
  await page.getByLabel('Obchodní jméno / jméno a příjmení').fill('Bez Účtu')
  await page.getByRole('button', { name: 'Pokračovat' }).click()
  await skipOnboardingBank(page)
  await expect(page.getByRole('link', { name: 'Přidat bankovní účet' })).toBeVisible()
})
