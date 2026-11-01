import { expect, type Page, test } from '@playwright/test'
import {
  addBankAccount,
  amountRe,
  createContact,
  fillLines,
  ICO,
  onboardByIco,
  pickCustomer,
  signUp,
  testEmail,
} from './helpers'

type Variant = {
  name: string
  tag: string
  supplierIco: string
  supplierName: string
  lines: { description: string; quantity: string; unitPrice: string; vatRate?: string }[]
  /** Hand-calculated: VAT per rate on the recap, rounded to 2 decimals (docs/DOMAIN.md). */
  total: string
  vatPayer: boolean
  vatLines?: string[]
}

const variants: Variant[] = [
  {
    name: 'non-VAT payer',
    tag: 'np',
    supplierIco: ICO.nonPayerSupplier,
    supplierName: 'E2E Neplátce Novák',
    // 2 × 1 500,00 + 1 × 750,50 = 3 750,50
    lines: [
      { description: 'Konzultace', quantity: '2', unitPrice: '1500' },
      { description: 'Licence', quantity: '1', unitPrice: '750.50' },
    ],
    total: '3 750,50',
    vatPayer: false,
  },
  {
    name: 'VAT payer',
    tag: 'vp',
    supplierIco: ICO.payerSupplier,
    supplierName: 'E2E Plátce s.r.o.',
    // 21 %: 3 × 1 000,10 = 3 000,30 -> VAT 630,06   12 %: 2 × 499,99 = 999,98 -> VAT 120,00
    // total = 3 000,30 + 630,06 + 999,98 + 120,00 = 4 750,34
    lines: [
      { description: 'Vývoj', quantity: '3', unitPrice: '1000.10', vatRate: '21' },
      { description: 'Školení', quantity: '2', unitPrice: '499.99', vatRate: '12' },
    ],
    total: '4 750,34',
    vatPayer: true,
    vatLines: ['630,06', '120,00'],
  },
]

const documentId = (page: Page) => new URL(page.url()).pathname.split('/').pop() as string

for (const v of variants) {
  test(`MVP journey — ${v.name}`, async ({ page, browser }) => {
    const customerName = 'E2E Odběratel s.r.o.'

    await test.step('sign up (email + password) and land in onboarding', async () => {
      await signUp(page, testEmail(v.tag))
    })

    await test.step('onboarding by IČO fills the profile from (mock) ARES', async () => {
      await onboardByIco(page, v.supplierIco, v.supplierName)
    })

    await test.step('dashboard is empty and offers the first invoice', async () => {
      await expect(page.getByText('Začněte první fakturou')).toBeVisible()
    })

    await test.step('add a bank account from a Czech number and see the IBAN', async () => {
      await addBankAccount(page)
    })

    await test.step('create a contact', async () => {
      await createContact(page, customerName)
    })

    await test.step('create an invoice with two lines; totals match the hand calculation', async () => {
      await page.goto('/faktury/nova')
      await pickCustomer(page, customerName)
      await expect(page.getByText('automaticky při vystavení')).toBeVisible()
      await fillLines(page, v.lines)
      const total = page.getByText('Celkem k úhradě').locator('..')
      await expect(total).toContainText(amountRe(v.total))
      if (v.vatLines) {
        for (const vat of v.vatLines) await expect(page.getByText(amountRe(vat)).first()).toBeVisible()
      } else {
        await expect(page.getByText('Nejste plátcem DPH, faktura bude bez DPH.')).toBeVisible()
      }
    })

    await test.step('issue allocates the number YYYY-0001', async () => {
      await page.getByRole('button', { name: 'Vystavit', exact: true }).click()
      await page.waitForURL(/\/faktury\/[^/]+$/)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^\d{4}-0001$/)
      await expect(page.getByText('Vystavená', { exact: true }).first()).toBeVisible()
      // Variable symbol defaults to the digits of the number.
      await expect(page.getByText(/^\d{4}0001$/)).toBeVisible()
      await expect(page.getByText('CZ6508000000192000145399')).toBeVisible()
    })

    const id = documentId(page)

    await test.step('PDF download returns application/pdf', async () => {
      const res = await page.request.get(`/api/documents/${id}/pdf`)
      expect(res.status()).toBe(200)
      expect(res.headers()['content-type']).toContain('application/pdf')
      const body = await res.body()
      expect(body.subarray(0, 5).toString()).toBe('%PDF-')
    })

    await test.step('public link /f/:token works without a session', async () => {
      const href = await page.getByRole('link', { name: 'Veřejný odkaz' }).getAttribute('href')
      expect(href).toMatch(/\/f\/[\w-]+$/)
      const anon = await browser.newContext({ locale: 'cs-CZ' })
      const pub = await anon.newPage()
      await pub.goto(new URL(href as string).pathname)
      await expect(pub.getByText(v.supplierName).first()).toBeVisible()
      await expect(pub.getByText(customerName).first()).toBeVisible()
      await expect(pub.getByText(v.vatPayer ? 'Faktura – daňový doklad' : 'Faktura', { exact: true })).toBeVisible()
      await expect(pub.getByText(amountRe(v.total)).first()).toBeVisible()
      const token = new URL(pub.url()).pathname.split('/').pop()
      const pdf = await pub.request.get(`/f/${token}/pdf`)
      expect(pdf.status()).toBe(200)
      expect(pdf.headers()['content-type']).toContain('application/pdf')
      await anon.close()
    })

    await test.step('dashboard shows the unpaid amount before payment', async () => {
      await page.goto('/')
      const unpaid = page.locator('div.rounded-xl', { hasText: 'Neuhrazeno' }).first()
      await expect(unpaid).toContainText(amountRe(v.total))
    })

    await test.step('mark paid', async () => {
      await page.goto(`/faktury/${id}`)
      await page.getByRole('button', { name: 'Označit jako zaplacenou' }).first().click()
      await page.getByRole('button', { name: 'Označit jako zaplacenou' }).last().click()
      await expect(page.getByText('Zaplacená', { exact: true }).first()).toBeVisible()
    })

    await test.step('dashboard KPIs update', async () => {
      await page.goto('/')
      const unpaid = page.locator('div.rounded-xl', { hasText: 'Neuhrazeno' }).first()
      await expect(unpaid).toContainText(/0,00/)
      await expect(unpaid).not.toContainText(amountRe(v.total))
      await expect(page.locator('div.rounded-xl', { hasText: 'Po splatnosti' }).first()).toContainText('Žádné')
      await expect(page.getByText('Poslední doklady')).toBeVisible()
    })
  })
}
