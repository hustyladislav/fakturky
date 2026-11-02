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

test('after issuing, Sdílet is primary and copies the link; paying has one click and an undo', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await signUp(page, testEmail('share'))
  await onboardByIco(page, ICO.nonPayerSupplier, 'E2E Neplátce Novák')
  await addBankAccount(page)
  await createContact(page, 'Sdílení s.r.o.')
  const id = await issueInvoice(page, 'Sdílení s.r.o.', '1000')
  await page.waitForLoadState('networkidle')

  const hero = page.getByTestId('doc-hero')
  await hero.getByRole('button', { name: 'Sdílet' }).click()
  await expect(hero.getByRole('button', { name: 'Zkopírováno' })).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/\/f\/[\w-]+$/)

  // Paying is a single click on the main segment and can be undone for a few seconds.
  await hero.getByRole('button', { name: 'Označit jako zaplacenou' }).click()
  await expect(page.getByText('Zaplacená', { exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Vrátit zpět' }).click()
  await expect(page.getByText('Vystavená', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Platba byla odebrána.')).toBeVisible()

  // The caret opens the amount and date form with its own confirm button.
  await hero.getByRole('button', { name: 'Další možnosti platby' }).click()
  await page.getByRole('menuitem', { name: /Jiná částka/ }).click()
  await page.getByLabel('Přijatá částka').fill('400')
  await page.getByRole('button', { name: 'Uložit platbu' }).click()
  await expect(page.getByText('Částečně uhrazená', { exact: true }).first()).toBeVisible()
  // Part-paid: getting paid stays the primary action.
  await expect(hero.getByRole('button', { name: 'Označit jako zaplacenou' })).toBeVisible()
  expect(id).toBeTruthy()
})

test.describe('on a phone', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 1280, height: 900 } })

  test('Sdílet opens the native share sheet with the public link and the PDF', async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __shared?: unknown }
      navigator.canShare = () => true
      navigator.share = async (data) => {
        w.__shared = {
          url: data?.url ?? null,
          text: data?.text ?? null,
          files: (data?.files ?? []).map((f) => f.type),
        }
      }
    })
    await signUp(page, testEmail('share-m'))
    await onboardByIco(page, ICO.nonPayerSupplier, 'E2E Neplátce Novák')
    await addBankAccount(page)
    await createContact(page, 'Telefon s.r.o.')
    const id = await issueInvoice(page, 'Telefon s.r.o.', '1000')
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`/faktury/${id}`)
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: 'Sdílet' }).last().click()
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __shared?: unknown }).__shared))
      .toMatchObject({ files: ['application/pdf'], text: expect.stringMatching(/\/f\/[\w-]+$/) })
  })
})
