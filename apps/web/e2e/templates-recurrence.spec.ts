import { expect, test } from '@playwright/test'
import {
  addBankAccount,
  clickMoreAction,
  createContact,
  ICO,
  issueInvoice,
  onboardByIco,
  signUp,
  testEmail,
} from './helpers'

test('template toast offers "Nastavit opakování"; the form states when the first invoice appears', async ({
  page,
}) => {
  await signUp(page, testEmail('tpl'))
  await onboardByIco(page, ICO.nonPayerSupplier, 'E2E Neplátce Novák')
  await addBankAccount(page)
  await createContact(page, 'Šablonový s.r.o.')
  await issueInvoice(page, 'Šablonový s.r.o.', '1000')

  await clickMoreAction(page, 'Uložit jako šablonu')
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByLabel('Název šablony')).toHaveValue('Služba · Šablonový s.r.o.')
  await dialog.getByRole('button', { name: 'Uložit', exact: true }).click()
  await expect(page.getByText('Šablona byla uložena.')).toBeVisible()
  await page.getByRole('button', { name: 'Nastavit opakování' }).click()

  await page.waitForURL(/\/sablony\?opakovat=/)
  const summary = page.getByTestId('repeat-summary')
  await expect(summary).toContainText('První automatická faktura vznikne')
  await expect(summary).toContainText('Vznikne jen koncept')
  // Sending only makes sense once the invoice is issued automatically.
  const send = page.getByLabel('Po vystavení poslat e-mailem')
  await expect(send).toBeDisabled()
  await page.getByLabel('Rovnou vystavit (jinak vznikne koncept)').check()
  await expect(send).toBeEnabled()
  await send.check()
  await expect(summary).toContainText('Vystaví se sama a pošle e-mailem odběrateli.')
  await page.getByLabel('Den v měsíci').fill('1')
  await expect(summary).toContainText(/vznikne \d{1,2}\. \d{1,2}\. \d{4} ráno/)
  await page.getByRole('button', { name: 'Nastavit opakování' }).click()
  await expect(page.getByText(/Opakování je nastaveno, první faktura vznikne/)).toBeVisible()
  await expect(page.getByText('vystaví a odešle')).toBeVisible()
})
