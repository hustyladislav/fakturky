import { expect, test } from '@playwright/test'
import { ICO, signUp, testEmail } from './helpers'

test.describe('onboarding ARES prefill', () => {
  test('eight valid digits look the company up with no button; DIČ, VAT status and spisová značka fill the form and the card', async ({
    page,
  }) => {
    await signUp(page, testEmail('ares-auto'))
    await page.waitForLoadState('networkidle')

    await page.getByLabel('IČO').fill(ICO.payerSupplier)

    await expect(page.getByLabel('Obchodní jméno / jméno a příjmení')).toHaveValue(
      'E2E Plátce s.r.o.',
    )
    await expect(page.getByLabel('DIČ')).toHaveValue('CZ12345016')
    await expect(page.getByLabel('Plátcovství DPH')).toHaveValue('payer')
    await expect(page.getByLabel('Zápis v rejstříku')).toHaveValue(
      'Zapsána v obchodním rejstříku vedeném Krajským soudem v Brně, oddíl C, vložka 12345.',
    )
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

    await expect(page.getByLabel('Zápis v rejstříku')).toHaveValue(
      'Fyzická osoba zapsaná v živnostenském rejstříku.',
    )
    await expect(page.getByLabel('Plátcovství DPH')).toHaveValue('non_payer')
    await expect(page.getByTestId('business-card')).toContainText('Neplátce DPH')
  })
})
