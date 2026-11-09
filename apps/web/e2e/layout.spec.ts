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

const WIDTHS = [320, 390, 1280]

test('no page scrolls sideways and no button overflows, from small phones to desktop', async ({
  page,
}) => {
  await signUp(page, testEmail('layout'))
  await onboardByIco(page, ICO.nonPayerSupplier, 'E2E Neplátce Novák')
  await addBankAccount(page)
  await createContact(page, 'Šířka s.r.o.')
  const invoiceId = await issueInvoice(page, 'Šířka s.r.o.')

  const paths = [
    '/prehled',
    '/faktury',
    '/faktury/nova',
    `/faktury/${invoiceId}`,
    '/kontakty',
    '/banka',
    '/nastaveni',
    '/sablony',
  ]
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 800 })
    for (const path of paths) {
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      const problems = await page.evaluate(() => {
        const root = document.documentElement
        const overflowing = [...document.querySelectorAll('button, [data-slot="button"]')]
          .filter((b) => b.getClientRects().length > 0 && b.scrollWidth > b.clientWidth + 1)
          .map((b) => b.getAttribute('aria-label') ?? b.textContent)
        return root.scrollWidth > root.clientWidth + 1
          ? ['page scrolls sideways', ...overflowing]
          : overflowing
      })
      expect(problems, `${path} at ${width} px`).toEqual([])
    }
  }
})
