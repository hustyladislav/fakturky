import { expect, test } from '@playwright/test'
import { ICO, onboardByIco, signUp, testEmail } from './helpers'

test.describe('onboarding ARES prefill', () => {
  test('eight valid digits look the company up with no button; the summary, VAT status and the details expander carry DIČ, spisová značka and the card', async ({
    page,
  }) => {
    await signUp(page, testEmail('ares-auto'))
    await page.waitForLoadState('networkidle')

    await page.getByLabel('IČO').fill(ICO.payerSupplier)

    const summary = page.getByTestId('profile-summary')
    await expect(summary).toContainText('E2E Plátce s.r.o.')
    await expect(summary).toContainText('CZ12345016')
    await expect(page.getByLabel('Plátcovství DPH')).toHaveValue('payer')

    await page.getByRole('button', { name: 'Upravit údaje' }).click()
    await expect(page.getByLabel('Obchodní jméno / jméno a příjmení')).toHaveValue(
      'E2E Plátce s.r.o.',
    )
    await expect(page.getByLabel('DIČ')).toHaveValue('CZ12345016')
    await expect(page.getByLabel('Zápis v rejstříku')).toHaveValue(
      'Zapsána v obchodním rejstříku vedeném Krajským soudem v Brně, oddíl C, vložka 12345.',
    )

    // The same values land on the card of the done screen.
    await page.getByRole('button', { name: 'Pokračovat' }).click()
    await page.getByRole('button', { name: 'Přeskočit' }).click()
    const card = page.getByTestId('business-card')
    await expect(card).toContainText('Plátce DPH')
    await expect(card).toContainText('CZ12345016')
  })

  test('a sole trader gets the živnostenský rejstřík line and stays a non-payer', async ({
    page,
  }) => {
    await signUp(page, testEmail('ares-osvc'))
    await page.waitForLoadState('networkidle')

    await page.getByLabel('IČO').fill(ICO.nonPayerSupplier)
    await expect(page.getByTestId('profile-summary')).toContainText('E2E Neplátce Novák')

    await expect(page.getByLabel('Plátcovství DPH')).toHaveValue('non_payer')
    await page.getByRole('button', { name: 'Upravit údaje' }).click()
    await expect(page.getByLabel('Zápis v rejstříku')).toHaveValue(
      'Fyzická osoba zapsaná v živnostenském rejstříku.',
    )
  })

  test('the person can correct the VAT status and add e-mail and phone through "Upravit údaje"; all of it is saved', async ({
    page,
  }) => {
    await signUp(page, testEmail('ares-details'))
    await page.waitForLoadState('networkidle')

    await page.getByLabel('IČO').fill(ICO.payerSupplier)
    await expect(page.getByTestId('profile-summary')).toContainText('E2E Plátce s.r.o.')
    await page.getByLabel('Plátcovství DPH').selectOption('identified_person')
    await page.getByRole('button', { name: 'Upravit údaje' }).click()
    await page.getByLabel('E-mail').fill('fakturace@example.cz')
    await page.getByLabel('Telefon').fill('+420 777 123 456')
    await page.getByRole('button', { name: 'Pokračovat' }).click()
    await page.getByRole('button', { name: 'Přeskočit' }).click()
    // The saved profile reaches the done screen's card with the corrected status.
    await expect(page.getByTestId('business-card')).toContainText('Identifikovaná osoba')
    await page.getByRole('button', { name: 'Přejít na přehled' }).click()

    // (Nastavení re-runs the ARES lookup for a stored IČO, so only e-mail and phone are stable there.)
    await page.goto('/nastaveni')
    await page.waitForLoadState('networkidle')
    await expect(page.getByLabel('E-mail', { exact: true }).first()).toHaveValue(
      'fakturace@example.cz',
    )
    await expect(page.getByLabel('Telefon')).toHaveValue('+420 777 123 456')
  })

  test('"Změnit IČO" goes back to the question, keeping what was typed', async ({ page }) => {
    await signUp(page, testEmail('ares-change'))
    await page.waitForLoadState('networkidle')

    await page.getByLabel('IČO').fill(ICO.nonPayerSupplier)
    await expect(page.getByTestId('profile-summary')).toBeVisible()
    await page.getByRole('button', { name: 'Změnit IČO' }).click()
    await expect(page.getByLabel('IČO')).toHaveValue(ICO.nonPayerSupplier)
    await expect(page.getByTestId('profile-summary')).toBeHidden()
  })
})

test('a slow ARES answer for an older IČO never replaces the newer one', async ({ page }) => {
  await signUp(page, testEmail('ares-race'))
  await page.route(/lookup/i, async (route) => {
    if (route.request().postData()?.includes(ICO.nonPayerSupplier)) {
      await new Promise((r) => setTimeout(r, 1500))
    }
    await route.continue()
  })
  await page.getByLabel('IČO').fill(ICO.nonPayerSupplier)
  await page.getByLabel('IČO').fill(ICO.payerSupplier)
  await expect(page.getByTestId('profile-summary')).toContainText('E2E Plátce s.r.o.')
  await page.waitForTimeout(2000)
  await expect(page.getByTestId('profile-summary')).toContainText('E2E Plátce s.r.o.')
})

test('choosing manual entry is not undone by a lookup still in flight', async ({ page }) => {
  await signUp(page, testEmail('ares-manual'))
  await page.route(/lookup/i, async (route) => {
    await new Promise((r) => setTimeout(r, 1500))
    await route.continue()
  })
  await page.getByLabel('IČO').fill(ICO.nonPayerSupplier)
  await page.getByRole('button', { name: /vyplnit ručně/ }).click()
  await page.getByLabel('Obchodní jméno / jméno a příjmení').fill('Moje firma ručně')
  await page.waitForTimeout(2000)
  await expect(page.getByLabel('Obchodní jméno / jméno a příjmení')).toHaveValue('Moje firma ručně')
})

test('reopening Nastavení keeps a manual edit instead of re-reading ARES', async ({ page }) => {
  await signUp(page, testEmail('ares-settings'))
  await onboardByIco(page, ICO.nonPayerSupplier, 'E2E Neplátce Novák')
  await page.goto('/nastaveni')
  await page.waitForLoadState('networkidle')
  await page.getByLabel('Ulice a číslo').fill('Moje ulice 1')
  await page.getByRole('button', { name: 'Uložit', exact: true }).first().click()
  await expect(page.getByText('Údaje byly uloženy.')).toBeVisible()

  await page.reload()
  await page.waitForLoadState('networkidle')
  await expect(page.getByLabel('Ulice a číslo')).toHaveValue('Moje ulice 1')
})
