import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import {
  addBankAccount,
  createContact,
  ICO,
  issueInvoice,
  onboardByIco,
  signUp,
  testEmail,
  todayPrague,
} from './helpers'

const template = readFileSync(new URL('./fixtures/fio-statement.csv', import.meta.url), 'utf8')

/** The Fio export fixture with today's date and the invoice's variable symbol filled in. */
function statement(vs: string) {
  const [y, m, d] = todayPrague().split('-')
  return template.replaceAll('{{DATE}}', `${d}.${m}.${y}`).replaceAll('{{VS}}', vs)
}

test('bank statement upload pairs the payment by variable symbol and marks the invoice paid', async ({
  page,
}) => {
  await signUp(page, testEmail('bank'))
  await onboardByIco(page, ICO.nonPayerSupplier, 'E2E Neplátce Novák')
  await addBankAccount(page)
  await createContact(page, 'Platící Zákazník s.r.o.')
  const invoiceId = await issueInvoice(page, 'Platící Zákazník s.r.o.', '1000')
  const vs = (
    await page
      .getByTestId('payment-card')
      .getByText('Variabilní symbol')
      .locator('..')
      .textContent()
  )?.match(/\d{6,10}/)?.[0]
  expect(vs).toBeTruthy()

  // Upload the Fio CSV.
  await page.goto('/banka')
  await page.waitForLoadState('networkidle')
  await expect(page.getByRole('heading', { name: 'Zatím tu nejsou žádné platby' })).toBeVisible()
  await page.getByRole('button', { name: 'Nahrát výpis' }).first().click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Soubor výpisu').setInputFiles({
    name: 'fio-vypis.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(statement(vs as string)),
  })
  // Before anything is stored the dialog shows what the file contains, including the outgoing payment.
  const preview = dialog.getByTestId('import-preview')
  await expect(preview).toContainText('Řádků ve výpisu: 3')
  await expect(preview).toContainText('Neznámý plátce')
  await expect(preview).toContainText('Odchozí platba, uloží se, nepáruje se')
  await dialog.getByRole('button', { name: 'Nahrát', exact: true }).click()

  // Every row is accounted for: paired, unmatched, and the card payment skipped with its reason.
  const result = dialog.getByTestId('import-result')
  await expect(result).toContainText('Zpracováno řádků: 3')
  await expect(result).toContainText('Spárováno: 1')
  await expect(result).toContainText('Nespárováno: 1')
  await expect(result).toContainText('Přeskočeno: 1')
  await expect(result).toContainText(/Spárováno s fakturou \d{4}-\d{4}/)
  await expect(result).toContainText('Přeskočeno: odchozí platba')
  await dialog.getByRole('button', { name: 'Hotovo' }).click()

  // The unmatched tab holds only the unexplained incoming payment; the debit lives under "Odchozí".
  const rows = page.getByTestId('bank-row')
  await expect(rows).toHaveCount(1)
  await expect(rows.first()).toContainText('Neznámý plátce')
  await expect(page.getByRole('tab', { name: 'Nespárované 1', exact: true })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Spárované 1', exact: true })).toBeVisible()

  // The invoice is paid by bank transfer.
  await page.goto(`/faktury/${invoiceId}`)
  await expect(page.getByText('Zaplacená').first()).toBeVisible()
  await expect(page.getByTestId('paid-by-transfer')).toContainText('Uhrazeno převodem dne')
  await expect(page.getByText('Spárováno s platbou z banky')).toBeVisible()

  // Uploading the same file again changes nothing.
  await page.goto('/banka')
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'Nahrát výpis' }).first().click()
  await page
    .getByRole('dialog')
    .getByLabel('Soubor výpisu')
    .setInputFiles({
      name: 'fio-vypis.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(statement(vs as string)),
    })
  await page.getByRole('dialog').getByRole('button', { name: 'Nahrát', exact: true }).click()
  await expect(page.getByTestId('import-result')).toContainText('Přeskočeno: 3')
  await expect(page.getByTestId('import-result')).toContainText('Přeskočeno: už bylo nahráno')
  await page.getByRole('dialog').getByRole('button', { name: 'Hotovo' }).click()
  await page.getByRole('tab', { name: /^Odchozí/ }).click()
  await expect(page.getByTestId('bank-row')).toHaveCount(1)
  await expect(page.getByTestId('bank-row').first()).toContainText('89,90')
  await page.getByRole('tab', { name: /^Nespárované/ }).click()

  // Ignore the stray payment, then undo the pairing: the invoice is open again.
  await page.getByRole('button', { name: 'Ignorovat' }).click()
  await expect(page.getByText('Platba byla ignorována.')).toBeVisible()
  await page.getByRole('tab', { name: /^Spárované/ }).click()
  await page.getByRole('button', { name: 'Zrušit spárování' }).click()
  await expect(page.getByText('Spárování bylo zrušeno.')).toBeVisible()
  await page.goto(`/faktury/${invoiceId}`)
  await expect(page.getByTestId('paid-by-transfer')).toHaveCount(0)
  await expect(page.getByText('Zaplacená')).toHaveCount(0)
})
