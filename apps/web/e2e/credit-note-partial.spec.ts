import { expect, test } from '@playwright/test'
import {
  addBankAccount,
  amountRe,
  clickMoreAction,
  createContact,
  ICO,
  issueInvoice,
  onboardByIco,
  signUp,
  testEmail,
} from './helpers'

test('partial credit note: VAT-inclusive amount with a live base/VAT split, reason preset, correct total', async ({
  page,
}) => {
  await signUp(page, testEmail('cnp'))
  await onboardByIco(page, ICO.payerSupplier, 'E2E Plátce s.r.o.')
  await addBankAccount(page)
  await createContact(page, 'Část s.r.o.', { street: 'Hlavní 1', city: 'Praha', zip: '11000' })
  const invoiceId = await issueInvoice(page, 'Část s.r.o.', '1000')
  await expect(page.getByText(amountRe('1 210,00')).first()).toBeVisible()

  await clickMoreAction(page, 'Vytvořit opravný doklad')
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('radio', { name: 'Jen část' }).click()
  const amount = dialog.getByLabel('Částka k vrácení vč. DPH')
  await amount.fill('1300')
  await expect(dialog.getByText('Částka nesmí být vyšší než')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Vytvořit opravný doklad' })).toBeDisabled()

  await amount.fill('605')
  const split = dialog.getByTestId('credit-split')
  await expect(split).toContainText('21 %')
  await expect(split).toContainText(amountRe('500,00'))
  await expect(split).toContainText(amountRe('105,00'))
  await dialog.getByRole('button', { name: 'Sleva', exact: true }).click()
  await expect(dialog.getByLabel('Důvod opravy')).toHaveValue('Sleva')
  await dialog.getByRole('button', { name: 'Vytvořit opravný doklad' }).click()

  await expect(page.getByRole('heading', { name: 'Upravit koncept' })).toBeVisible()
  await page.getByRole('button', { name: 'Vystavit', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^D\d{4}-0001$/)
  await expect(page.getByText(amountRe('605,00')).first()).toBeVisible()
  const cnId = new URL(page.url()).pathname.split('/').pop()
  const pdf = await page.request.get(`/api/documents/${cnId}/pdf`)
  expect(pdf.status()).toBe(200)

  // The invoice is only partly settled by it.
  await page.goto(`/faktury/${invoiceId}`)
  await expect(page.getByText(/Z toho dobropisem D\d{4}-0001/)).toBeVisible()
  await expect(page.getByText(amountRe('605,00')).first()).toBeVisible()
})
