import { expect, test } from '@playwright/test'
import { addBankAccount, createContact, ICO, onboardByIco, signUp, testEmail } from './helpers'

test('proforma → paid → final invoice with the advance deducted (non-VAT payer)', async ({
  page,
}) => {
  await signUp(page, testEmail('adv'))
  await onboardByIco(page, ICO.nonPayerSupplier, 'E2E Neplátce Novák')
  await addBankAccount(page)
  await createContact(page, 'Záloha s.r.o.')

  await page.goto('/faktury/nova')
  await page.waitForLoadState('networkidle')
  await page.getByLabel('Typ dokladu').selectOption('proforma')
  await page.getByLabel('Odběratel', { exact: true }).fill('Záloha')
  await page.getByRole('button', { name: /Záloha s\.r\.o\./ }).click()
  await page.getByLabel('Popis', { exact: true }).locator('visible=true').first().fill('Projekt')
  await page.getByLabel('Cena za MJ', { exact: true }).locator('visible=true').first().fill('5000')
  await page.getByRole('button', { name: 'Vystavit', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^Z\d{4}-0001$/)

  await page.getByRole('button', { name: 'Označit jako zaplacenou' }).first().click()
  await page.getByRole('button', { name: 'Označit jako zaplacenou' }).last().click()
  await expect(page.getByText('Zaplacená', { exact: true }).first()).toBeVisible()

  // The paid proforma links to nothing yet; creating the final invoice adds it to the related documents.
  await page.getByRole('button', { name: 'Vystavit konečnou fakturu' }).first().click()
  await expect(page.getByRole('heading', { name: 'Upravit koncept' })).toBeVisible()
  await expect(page.locator('input[value^="Uhrazená záloha"]').first()).toBeVisible()
  await page.getByRole('button', { name: 'Vystavit', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^\d{4}-0001$/)
  // Fully covered by the advance: settled on issue.
  await expect(page.getByText('Zaplacená', { exact: true }).first()).toBeVisible()
  // The final invoice points back to the proforma.
  await expect(
    page
      .getByRole('region', { name: 'Související doklady' })
      .getByRole('link', { name: /^Z\d{4}-0001$/ }),
  ).toBeVisible()
})
