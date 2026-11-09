import { expect, test, vi } from 'vitest'

const loaded = vi.hoisted(() => ({ pdf: false, email: false }))

vi.mock('./runtime', () => ({ getRuntime: async () => ({ handle: { db: {} }, auth: {} }) }))
vi.mock('@fakturky/core/auth', () => ({ resolvePrincipal: async () => null }))
vi.mock('./pdf', () => {
  loaded.pdf = true
  return { renderDocumentPdf: async () => 'rendered' }
})
vi.mock('@fakturky/email', () => {
  loaded.email = true
  return { sendInvoiceEmail: vi.fn(), EmailDeliveryError: class extends Error {} }
})

const { createContext } = await import('./context')

test('a plain request loads neither the PDF renderer nor the e-mail templates', async () => {
  await createContext(new Headers())
  expect(loaded).toEqual({ pdf: false, email: false })
})

test('the PDF renderer loads when a PDF is actually needed', async () => {
  const { services } = await createContext(new Headers())
  const render = services?.renderPdf as unknown as () => Promise<string>
  await expect(render()).resolves.toBe('rendered')
  expect(loaded.pdf).toBe(true)
})
