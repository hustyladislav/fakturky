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
