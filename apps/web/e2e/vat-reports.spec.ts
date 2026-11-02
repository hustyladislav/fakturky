import { readFile } from 'node:fs/promises'
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
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
  todayPrague,
} from './helpers'

const CUSTOMER = 'E2E Odběratel a.s.'

async function issue(page: import('@playwright/test').Page, unitPrice: string) {
  await page.goto('/faktury/nova')
  await page.waitForLoadState('networkidle')
  await pickCustomer(page, CUSTOMER)
  await fillLines(page, [{ description: 'Služba', quantity: '1', unitPrice, vatRate: '21' }])
  await page.getByRole('button', { name: 'Vystavit', exact: true }).click()
  await page.waitForURL(
    (u) => /^\/faktury\/[^/]+$/.test(u.pathname) && u.pathname !== '/faktury/nova',
  )
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^\d{4}-\d{4}$/)
}

test('DPH: a VAT payer previews the period and downloads the control statement XML', async ({
  page,
}) => {
  await signUp(page, testEmail('dph'))
  await onboardByIco(page, ICO.payerSupplier, 'E2E Plátce s.r.o.')
  await addBankAccount(page)
  await createContact(page, CUSTOMER, {
    dic: 'CZ12345024',
    street: 'Hlavní 7',
    city: 'Ostrava',
    zip: '70200',
  })

  await test.step('two invoices: 12 100 Kč incl. VAT (A.4) and 1 210 Kč (A.5)', async () => {
    await issue(page, '10000')
    await issue(page, '1000')
  })

  await test.step('the DPH page is in the navigation and carries the disclaimer', async () => {
    await page.goto('/prehled')
    await page.getByRole('link', { name: /^DPH/ }).locator('visible=true').first().click()
    await expect(page).toHaveURL(/\/dph$/)
    await expect(page.getByRole('heading', { level: 1, name: 'DPH' })).toBeVisible()
    await expect(
      page.getByText('Kontrolujte před podáním — aplikace nenahrazuje daňového poradce.'),
    ).toBeVisible()
  })

  await test.step('downloads are blocked until the filing details are filled in', async () => {
    await expect(page.getByRole('button', { name: 'Kontrolní hlášení (XML)' })).toBeDisabled()
    await page.getByLabel('Kód finančního úřadu').fill('451')
    await page.getByLabel('Typ daňového subjektu').selectOption('P')
    await page.getByRole('button', { name: 'Uložit údaje' }).click()
    await expect(page.getByText('Údaje pro podání jsme uložili.')).toBeVisible()
  })

  await test.step('pick the current month (the invoices are dated today)', async () => {
    const [year, month] = todayPrague().split('-')
    await page.getByLabel('Rok', { exact: true }).selectOption(String(Number(year)))
    await page.getByLabel('Měsíc', { exact: true }).selectOption(String(Number(month)))
  })

  await test.step('preview: rows, A.4 with the customer DIČ, A.5 and the drill-down', async () => {
    // ř.1: base 11 000 Kč, VAT 2 310 Kč
    const dph = page.locator('section', { hasText: 'Přiznání k DPH' }).first()
    await expect(dph).toContainText(amountRe('11 000'))
    await expect(dph).toContainText(amountRe('2 310'))
    const kh = page.locator('section', { hasText: 'Kontrolní hlášení' }).first()
    await expect(kh.getByText('12345024')).toBeVisible()
    await dph.getByRole('button', { name: '2 doklady' }).first().click()
    await expect(page.getByText('Doklady na řádku')).toBeVisible()
  })

  await test.step('download the control statement and check the key elements', async () => {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Kontrolní hlášení (XML)' }).click(),
    ])
    expect(download.suggestedFilename()).toMatch(/^kontrolni-hlaseni-\d{4}-\d{2}\.xml$/)
    const path = await download.path()
    const xml = await readFile(path, 'utf8')
    expect(xml).toContain('<DPHKH1 verzePis="03.01.15">')
    expect(xml).toContain('dokument="KH1"')
    expect(xml).toContain('khdph_forma="B"')
    // supplier from ARES (CZ12345016, s.r.o.) and the filing details just saved
    expect(xml).toContain('c_ufo="451"')
    expect(xml).toContain('dic="12345016"')
    expect(xml).toContain('typ_ds="P"')
    // A.4: the 12 100 Kč invoice with the customer's DIČ (digits only)
    expect(xml).toMatch(
      /<VetaA4 [^>]*dic_odb="12345024"[^>]*zakl_dane1="10000\.00"[^>]*dan1="2100\.00"/,
    )
    // A.5: the 1 210 Kč invoice, summed
    expect(xml).toContain('<VetaA5 zakl_dane1="1000.00" dan1="210.00"/>')
  })

  await test.step('the return XML has the output VAT rows in whole crowns', async () => {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Přiznání k DPH (XML)' }).click(),
    ])
    const xml = await readFile(await download.path(), 'utf8')
    expect(xml).toContain('<Veta1 obrat23="11000" dan23="2310" obrat5="0" dan5="0"/>')
  })

  await test.step('the populated page has no WCAG A/AA violations in both themes', async () => {
    for (const theme of ['light', 'dark'] as const) {
      await page.evaluate((th) => {
        localStorage.setItem('theme', th)
        document.documentElement.classList.toggle('dark', th === 'dark')
      }, theme)
      await page.reload()
      await page.waitForLoadState('networkidle')
      const { violations } = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()
      const summary = violations.map(
        (v) =>
          `${v.id}: ${v.nodes
            .map((n) => n.target.join(' '))
            .slice(0, 3)
            .join(' | ')}`,
      )
      expect(summary, `${theme}\n${summary.join('\n')}`).toEqual([])
    }
  })
})

test('DPH: a non-payer sees an explanation, not the reports', async ({ page }) => {
  await signUp(page, testEmail('dph-np'))
  await onboardByIco(page, ICO.nonPayerSupplier, 'E2E Neplátce Novák')
  await expect(page.getByRole('link', { name: /^DPH/ })).toHaveCount(0)
  await page.goto('/dph')
  await expect(page.getByText('Přehledy DPH jsou jen pro plátce')).toBeVisible()
})
