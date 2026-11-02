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
    let draftUrl = ''

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
      // A VAT payer's tax invoice needs the customer's address and IČO/DIČ (§29 ZDPH): start without them.
      await createContact(page, customerName)
    })

    await test.step('create an invoice with two lines; totals match the hand calculation', async () => {
      await page.goto('/faktury/nova')
      await pickCustomer(page, customerName)
      await expect(page.getByText('automaticky při vystavení')).toBeVisible()
      await fillLines(page, v.lines)
      if (v.vatPayer) {
        // There is no 0 % rate in Czech VAT: payers get 21/12 % plus VAT regimes instead.
        const vat = page.getByLabel('DPH', { exact: true }).locator('visible=true').first()
        await expect(vat.locator('option', { hasText: /^0 %$/ })).toHaveCount(0)
        await expect(vat.locator('option', { hasText: 'Osvobozeno od DPH' })).toHaveCount(1)
      }
      const total = page.getByText('Celkem k úhradě').locator('..')
      await expect(total).toContainText(amountRe(v.total))
      if (v.vatLines) {
        for (const vat of v.vatLines)
          await expect(page.getByText(amountRe(vat)).first()).toBeVisible()
      } else {
        await expect(page.getByText('Nejste plátcem DPH, faktura bude bez DPH.')).toBeVisible()
      }
    })

    if (v.vatPayer) {
      await test.step('a tax invoice without customer data is refused with a visible, field-level message', async () => {
        await page.getByRole('button', { name: 'Vystavit', exact: true }).click()
        const alert = page.getByRole('alert')
        await expect(alert).toContainText('Daňový doklad vyžaduje údaje odběratele')
        await expect(alert).toContainText('adresu')
        // The saved draft's URL is kept, so a refresh or the contacts link does not lose it.
        await expect(page).toHaveURL(/\/faktury\/[^/]+\/upravit$/)
        draftUrl = page.url()
      })
      await test.step('completing the contact lets the same draft be issued', async () => {
        await page.goto('/kontakty')
        // Wait for hydration: an early click on the server-rendered button does nothing.
        await page.waitForLoadState('networkidle')
        await page
          .getByRole('button', { name: 'Upravit', exact: true })
          .locator('visible=true')
          .first()
          .click()
        const dialog = page.getByRole('dialog')
        await expect(dialog).toBeVisible()
        await dialog.getByLabel('DIČ').fill('CZ12345024')
        await dialog.getByLabel('Ulice a číslo').fill('Hlavní 7')
        await dialog.getByLabel('Město').fill('Ostrava')
        await dialog.getByLabel('PSČ').fill('70200')
        await dialog.getByRole('button', { name: 'Uložit' }).click()
        await expect(dialog).toBeHidden()
      })
    }

    await test.step('issue allocates the number YYYY-0001', async () => {
      if (v.vatPayer) {
        await page.goto(draftUrl)
        await expect(page.getByText(customerName).first()).toBeVisible()
      }
      await page.getByRole('button', { name: 'Vystavit', exact: true }).click()
      // `/faktury/nova` also matches a naive pattern, so wait for the issued document's own URL.
      await page.waitForURL(
        (u) => /^\/faktury\/[^/]+$/.test(u.pathname) && u.pathname !== '/faktury/nova',
      )
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^\d{4}-0001$/, {
        timeout: 15_000,
      })
      await expect(page.getByText('Vystavená', { exact: true }).first()).toBeVisible()
      // Variable symbol defaults to the digits of the number (the rail and the paper both show it).
      await expect(page.getByText(/^\d{4}0001$/).first()).toBeVisible()
      await expect(page.getByText('CZ6508000000192000145399')).toBeVisible()
      // The payment card carries the QR Platba, black on white, at least 160 px wide (the paper has its own).
      const qr = page.getByTestId('payment-card').getByRole('img', { name: 'QR Platba' })
      await expect(qr).toBeVisible()
      expect((await qr.boundingBox())?.width).toBeGreaterThanOrEqual(160)
      await expect(page.getByText('Naskenujte v bankovní aplikaci')).toBeVisible()
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
      const href = await page.locator('a[href*="/f/"]').first().getAttribute('href')
      expect(href).toMatch(/\/f\/[\w-]+$/)
      const anon = await browser.newContext({
        locale: 'cs-CZ',
        baseURL: new URL(href as string).origin,
      })
      const pub = await anon.newPage()
      await pub.goto(href as string) // absolute URL: this context has no baseURL
      await expect(pub.getByText(v.supplierName).first()).toBeVisible()
      await expect(pub.getByText(customerName).first()).toBeVisible()
      await expect(
        pub.getByText(v.vatPayer ? 'Faktura – daňový doklad' : 'Faktura', { exact: true }),
      ).toBeVisible()
      await expect(pub.getByText(amountRe(v.total)).first()).toBeVisible()
      await expect(
        pub.getByTestId('public-qr').getByRole('img', { name: 'QR Platba' }),
      ).toBeVisible()
      const token = new URL(pub.url()).pathname.split('/').pop()
      const qrPng = await pub.request.get(`/f/${token}/qr.png`)
      expect(qrPng.status()).toBe(200)
      expect(qrPng.headers()['content-type']).toBe('image/png')
      expect((await qrPng.body()).subarray(1, 4).toString()).toBe('PNG')
      const pdf = await pub.request.get(`/f/${token}/pdf`)
      expect(pdf.status()).toBe(200)
      expect(pdf.headers()['content-type']).toContain('application/pdf')
      await anon.close()
    })

    await test.step('dashboard shows the unpaid amount before payment', async () => {
      await page.goto('/')
      const unpaid = page.locator('[data-slot=kpi-card]', { hasText: 'Neuhrazeno' }).first()
      await expect(unpaid).toContainText(amountRe(v.total))
    })

    await test.step('mark paid', async () => {
      await page.goto(`/faktury/${id}`)
      await page.getByRole('button', { name: 'Označit jako zaplacenou' }).first().click()
      await page.getByRole('button', { name: 'Označit jako zaplacenou' }).last().click()
      await expect(page.getByText('Zaplacená', { exact: true }).first()).toBeVisible()
      // Nothing left to pay: no QR on the detail page.
      await expect(page.getByRole('img', { name: 'QR Platba' })).toHaveCount(0)
    })

    await test.step('dashboard KPIs update', async () => {
      await page.goto('/')
      const unpaid = page.locator('[data-slot=kpi-card]', { hasText: 'Neuhrazeno' }).first()
      await expect(unpaid).toContainText('Vše je zaplaceno')
      await expect(unpaid).not.toContainText(amountRe(v.total))
      await expect(
        page.locator('[data-slot=kpi-card]', { hasText: 'Po splatnosti' }).first(),
      ).toContainText('Žádná faktura po splatnosti')
      await expect(page.getByText('Poslední doklady')).toBeVisible()
    })
  })
}
