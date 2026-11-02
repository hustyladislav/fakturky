import { expect, test } from '@playwright/test'
import {
  addBankAccount,
  createContact,
  ICO,
  issueInvoice,
  onboardByIco,
  signUp,
  testEmail,
} from './helpers'

test('invoice list search ignores case and diacritics; empty state names the filters', async ({
  page,
}) => {
  await signUp(page, testEmail('search'))
  await onboardByIco(page, ICO.nonPayerSupplier, 'E2E Neplátce Novák')
  await addBankAccount(page)
  await createContact(page, 'Studio Lípa s.r.o.')
  await createContact(page, 'Kovárna Beta')
  await issueInvoice(page, 'Studio Lípa s.r.o.', '26015')
  await issueInvoice(page, 'Kovárna Beta', '500')

  await page.goto('/faktury')
  await page.waitForLoadState('networkidle')
  const search = page.getByPlaceholder(/Hledat podle čísla/)
  const rows = page.locator('tr[data-doc-id]')

  await search.fill('lipa')
  await expect(rows).toHaveCount(1)
  await expect(rows.first()).toContainText('Studio Lípa s.r.o.')

  await search.fill('26 015')
  await expect(rows).toHaveCount(1)
  await expect(rows.first()).toContainText('Studio Lípa s.r.o.')

  await page.goto('/faktury?q=lipa&filter=paid')
  await expect(page.getByRole('heading', { name: /hledání „lipa“ · Zaplacené/ })).toBeVisible()
  await page.getByRole('button', { name: 'Zrušit filtry' }).click()
  await expect(rows).toHaveCount(2)
})

test('⌘K: search a contact, start an invoice for it, run parameterized commands', async ({
  page,
}) => {
  await signUp(page, testEmail('palette'))
  await onboardByIco(page, ICO.nonPayerSupplier, 'E2E Neplátce Novák')
  await addBankAccount(page)
  await createContact(page, 'Studio Lípa s.r.o.', { ico: '11223344' })
  const id = await issueInvoice(page, 'Studio Lípa s.r.o.', '26015')

  const openPalette = async () => {
    await page.goto('/prehled')
    await page.waitForLoadState('networkidle')
    await page.keyboard.press('Control+k')
    const input = page.getByRole('textbox', { name: 'Příkazy a vyhledávání' })
    await expect(input).toBeVisible()
    return input
  }
  const dialog = page.getByRole('dialog')

  // Diacritics-free query finds the document and the contact, grouped; the assistant is last.
  let input = await openPalette()
  await input.fill('lipa')
  await expect(dialog.getByText('Doklady', { exact: true })).toBeVisible()
  await expect(dialog.getByText('Kontakty', { exact: true })).toBeVisible()
  await expect(
    dialog.getByRole('button', { name: /^Studio Lípa s\.r\.o\. IČO 11223344/ }),
  ).toBeVisible()
  await expect(
    dialog.getByRole('button', { name: /^Studio Lípa s\.r\.o\. 20\d\d-\d{4}/ }),
  ).toBeVisible()
  const options = dialog.getByRole('button')
  await expect(options.last()).toContainText('Zeptat se asistenta')

  // Keyboard only: contact → "Nová faktura pro …" opens the editor with the customer preselected.
  await dialog.getByRole('button', { name: 'Nová faktura pro Studio Lípa s.r.o.' }).click()
  await expect(page).toHaveURL(/\/faktury\/nova$/)
  await expect(page.getByText('Studio Lípa s.r.o.').first()).toBeVisible()
  await expect(page.getByText('11223344').first()).toBeVisible()

  // "vystav fakturu pro …" puts the same action first; Enter alone runs it.
  input = await openPalette()
  await input.fill('vystav fakturu pro lipa')
  await expect(dialog.getByText('Rychlá akce')).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/faktury\/nova$/)
  await expect(page.getByText('11223344').first()).toBeVisible()

  // "po splatnosti" → overdue filter.
  input = await openPalette()
  await input.fill('po splatnosti')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/faktury\?filter=overdue/)

  // "zaplatit <number>" opens the payment panel of that invoice.
  await page.goto(`/faktury/${id}`)
  const number = (await page.getByRole('heading', { level: 1 }).textContent()) ?? ''
  input = await openPalette()
  await input.fill(`zaplatit ${number}`)
  await expect(dialog.getByRole('button', { name: /Označit .* jako zaplacenou/ })).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(new RegExp(`/faktury/${id}\\?zaplatit`))
  await expect(page.getByLabel('Datum platby')).toBeVisible()
})

test('paid rows show the payment day instead of a due countdown', async ({ page }) => {
  await signUp(page, testEmail('paidrow'))
  await onboardByIco(page, ICO.nonPayerSupplier, 'E2E Neplátce Novák')
  await addBankAccount(page)
  await createContact(page, 'Zákazník Zaplatil')
  await issueInvoice(page, 'Zákazník Zaplatil')

  await page.goto('/faktury')
  await page.waitForLoadState('networkidle')
  const row = page.locator('tr[data-doc-id]').first()
  await row.hover()
  await row.getByRole('button', { name: 'Označit jako zaplacenou' }).click()
  await expect(row).toContainText(/Zaplaceno \d{1,2}\. \d{1,2}\./)
  await expect(row).not.toContainText(/za \d+ dn/)
})
