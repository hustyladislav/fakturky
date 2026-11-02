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
  const vs = (await page.getByText('Variabilní symbol').locator('..').textContent())?.match(
    /\d{6,10}/,
  )?.[0]
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
  await dialog.getByRole('button', { name: 'Nahrát', exact: true }).click()
  await expect(page.getByText('Nahráno 3 nových plateb, 1 spárováno s fakturami.')).toBeVisible()

  // The unmatched tab holds only the unexplained incoming payment (the debit is not a payment to pair).
  const rows = page.getByTestId('bank-row')
  await expect(rows).toHaveCount(1)
  await expect(rows.first()).toContainText('Neznámý plátce')
  await expect(page.getByRole('tab', { name: 'Nespárované (1)', exact: true })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Spárované (1)', exact: true })).toBeVisible()

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
  await expect(page.getByText('Nahráno 0 nových plateb, 3 už bylo v systému.')).toBeVisible()

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
