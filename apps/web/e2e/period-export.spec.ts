import { readFileSync } from 'node:fs'
import { addDays, periodPreset, todayPrague } from '@fakturky/domain/dates'
import { expect, type Page, test } from '@playwright/test'
import { addBankAccount, ICO, onboardByIco, signUp, testEmail } from './helpers'

/** Calls the app's own oRPC endpoint as the signed-in user: the seam the UI itself uses. */
async function rpc<T>(page: Page, path: string, input: unknown): Promise<T> {
  return page.evaluate(
    async ([p, body]) => {
      const res = await fetch(`/api/rpc/${p}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ json: body }),
      })
      if (!res.ok) throw new Error(`${p} ${res.status} ${await res.text()}`)
      return ((await res.json()) as { json: unknown }).json
    },
    [path, input] as const,
  ) as Promise<T>
}

async function issueOn(page: Page, customer: string, issueDate: string, taxableDate?: string) {
  const c = await rpc<{ id: string }>(page, 'contacts/create', { name: customer })
  const d = await rpc<{ id: string }>(page, 'documents/createDraft', {
    contactId: c.id,
    issueDate,
    taxableDate,
    dueDate: addDays(issueDate, 14),
    lines: [{ description: 'Služba', quantity: '1', unitPrice: '1000' }],
  })
  return (await rpc<{ number: string }>(page, 'documents/issue', { id: d.id })).number
}

test('a period narrows the list and the CSV, and names the file after the month', async ({
  page,
}) => {
  await signUp(page, testEmail('period'))
  await onboardByIco(page, ICO.nonPayerSupplier, 'E2E Neplátce Novák')
  await addBankAccount(page)
  await page.goto('/faktury')
  await page.waitForLoadState('networkidle')

  const today = todayPrague()
  const last = periodPreset('lastMonth', today)
  const month = last.from.slice(0, 7)
  const monthStart = await issueOn(page, 'Prvního s.r.o.', last.from)
  const monthEnd = await issueOn(page, 'Posledního s.r.o.', last.to)
  // Issued last month but taxable this month: DUZP puts it outside last month.
  const laterDuzp = await issueOn(
    page,
    'Pozdní DUZP s.r.o.',
    last.to,
    periodPreset('thisMonth', today).from,
  )
  const old = await issueOn(page, 'Starý s.r.o.', addDays(last.from, -5))

  await page.goto('/faktury')
  await page.waitForLoadState('networkidle')
  for (const name of ['Prvního', 'Posledního', 'Pozdní DUZP', 'Starý']) {
    await expect(page.getByText(name).locator('visible=true').first()).toBeVisible()
  }

  await page.getByLabel('Období').selectOption({ label: 'Minulý měsíc' })
  await expect(page).toHaveURL(
    new RegExp(`from=${last.from}.*to=${last.to}|to=${last.to}.*from=${last.from}`),
  )
  await expect(page.getByText('Prvního').locator('visible=true').first()).toBeVisible()
  await expect(page.getByText('Posledního').locator('visible=true').first()).toBeVisible()
  await expect(page.getByText('Pozdní DUZP').locator('visible=true')).toHaveCount(0)
  await expect(page.getByText('Starý').locator('visible=true')).toHaveCount(0)
  // The subtitle's count follows the period.
  await expect(page.getByText(/^2 doklady · .*neuhrazeno$/)).toBeVisible()

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export do CSV' }).click(),
  ])
  expect(download.suggestedFilename()).toBe(`doklady-${month}.csv`)
  const csv = readFileSync(await download.path(), 'utf8')
  expect(csv).toContain(monthStart)
  expect(csv).toContain(monthEnd)
  expect(csv).not.toContain(laterDuzp)
  expect(csv).not.toContain(old)

  // The period survives a reload and clearing it brings every document back.
  await page.reload()
  await page.waitForLoadState('networkidle')
  await expect(page.getByLabel('Období')).toHaveValue('lastMonth')
  await page.getByLabel('Období').selectOption({ label: 'Všechna období' })
  await expect(page.getByText('Starý').locator('visible=true').first()).toBeVisible()
  await expect(page).not.toHaveURL(/from=/)
})

test('a custom range with no documents keeps the filters on screen', async ({ page }) => {
  await signUp(page, testEmail('period-empty'))
  await onboardByIco(page, ICO.nonPayerSupplier, 'E2E Neplátce Novák')
  await addBankAccount(page)
  await issueOn(page, 'Jediný s.r.o.', todayPrague())

  await page.goto('/faktury?from=2001-01-01&to=2001-01-31')
  await page.waitForLoadState('networkidle')
  await expect(page.getByLabel('Období')).toHaveValue('custom')
  await expect(page.getByText(/Nic nenalezeno/)).toBeVisible()
  await expect(page.getByLabel('Od')).toBeVisible()
  await page.getByRole('button', { name: 'Zrušit filtry' }).click()
  await expect(page.getByText('Jediný').locator('visible=true').first()).toBeVisible()
})
