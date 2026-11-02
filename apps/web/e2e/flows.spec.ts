import { expect, test } from '@playwright/test'
import {
  addBankAccount,
  amountRe,
  createContact,
  ICO,
  issueInvoice,
  onboardByIco,
  signUp,
  testEmail,
  todayPrague,
} from './helpers'

test('credit note: dialog → draft → issue; links both ways, invoice settled, PDF served', async ({
  page,
}) => {
  await signUp(page, testEmail('cn'))
  await onboardByIco(page, ICO.nonPayerSupplier, 'E2E Neplátce Novák')
  await addBankAccount(page)
  await createContact(page, 'Dobropis s.r.o.')
  const invoiceId = await issueInvoice(page, 'Dobropis s.r.o.', '1000')
  const invoiceNumber = (await page.getByRole('heading', { level: 1 }).textContent()) ?? ''

  await page.getByRole('button', { name: 'Vytvořit opravný doklad' }).first().click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Důvod opravy').fill('Storno služby')
  await dialog.getByRole('button', { name: 'Vytvořit opravný doklad' }).click()
  await expect(page.getByRole('heading', { name: 'Upravit koncept' })).toBeVisible()
  await page.getByRole('button', { name: 'Vystavit', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^D\d{4}-0001$/)

  // The credit note links back to the corrected invoice and asks for no payment.
  const related = page.getByRole('region', { name: 'Související doklady' })
  await expect(related.getByRole('link', { name: invoiceNumber, exact: true })).toBeVisible()
  const creditNoteId = new URL(page.url()).pathname.split('/').pop()
  const pdf = await page.request.get(`/api/documents/${creditNoteId}/pdf`)
  expect(pdf.status()).toBe(200)
  expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-')

  // The invoice lists the credit note and is settled by it.
  await page.goto(`/faktury/${invoiceId}`)
  await expect(
    page
      .getByRole('region', { name: 'Související doklady' })
      .getByRole('link', { name: /^D\d{4}-0001$/ }),
  ).toBeVisible()
  await expect(page.getByText('Zaplacená', { exact: true }).first()).toBeVisible()
  await expect(page.getByText(/Z toho dobropisem D\d{4}-0001/)).toBeVisible()
  await expect(page.getByText(amountRe('1 000,00')).first()).toBeVisible()

  // The list shows the type and can be narrowed to credit notes.
  await page.goto('/faktury')
  await page.waitForLoadState('networkidle')
  await page.getByLabel('Typ', { exact: true }).selectOption('credit_note')
  await expect(page.getByRole('link', { name: /^D\d{4}-0001$/ }).first()).toBeVisible()
  await expect(page.getByRole('link', { name: invoiceNumber, exact: true })).toHaveCount(0)
})

test('cron: refuses unauthorised calls; a due recurring rule issues its invoice', async ({
  page,
}) => {
  const secret = 'e2e-'.repeat(6)
  await signUp(page, testEmail('cron'))
  await onboardByIco(page, ICO.nonPayerSupplier, 'E2E Neplátce Novák')
  await addBankAccount(page)
  await createContact(page, 'Opakování s.r.o.')
  await issueInvoice(page, 'Opakování s.r.o.', '500')

  expect((await page.request.get('/api/cron/recurring')).status()).toBe(401)
  const wrong = await page.request.get('/api/cron/recurring', {
    headers: { authorization: 'Bearer not-the-secret-not-the-secret' },
  })
  expect(wrong.status()).toBe(401)
  expect((await page.request.get('/api/cron/reminders')).status()).toBe(401)
  expect((await page.request.get('/api/cron/bank-sync')).status()).toBe(401)

  // Save the invoice as a template and repeat it monthly from today, issuing automatically.
  await page.getByRole('button', { name: 'Uložit jako šablonu' }).first().click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Název šablony').fill('Měsíční služba')
  await dialog.getByRole('button', { name: 'Uložit' }).click()
  await page.goto('/sablony')
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'Opakovat' }).first().click()
  await page.getByLabel('Den v měsíci').fill(String(Number(todayPrague().slice(8))))
  await page.getByLabel('První vystavení od').fill(todayPrague())
  await page.getByLabel('Rovnou vystavit').check()
  await page.getByRole('button', { name: 'Nastavit opakování' }).click()
  await expect(page.getByText('Příští běh')).toBeVisible()

  const res = await page.request.get('/api/cron/recurring', {
    headers: { authorization: `Bearer ${secret}` },
  })
  expect(res.status()).toBe(200)
  const body = (await res.json()) as { processed: number; results: { issued?: boolean }[] }
  expect(body.processed).toBeGreaterThanOrEqual(1)
  expect(body.results.some((r) => r.issued)).toBe(true)

  // A second run the same day does nothing for this rule; the new invoice exists.
  await page.goto('/faktury')
  await expect(page.getByRole('link', { name: /^\d{4}-0002$/ }).first()).toBeVisible()
  const next = await page.request.get('/api/cron/recurring', {
    headers: { authorization: `Bearer ${secret}` },
  })
  expect(((await next.json()) as { results: unknown[] }).results).toEqual([])
})
