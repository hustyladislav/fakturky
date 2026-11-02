import { render } from '@react-email/render'
import { expect, test } from 'vitest'
import { InvoiceEmail } from './invoice'

const base = {
  supplierName: 'Dodavatel s.r.o.',
  number: '2026-0001',
  total: '1 000,00 Kč',
  dueDate: '15. 11. 2026',
  publicUrl: 'https://x.test/f/token',
}

test('shows the hosted payment QR with a hint when a QR URL is given', async () => {
  const html = await render(InvoiceEmail({ ...base, qrUrl: 'https://x.test/f/token/qr.png' }))
  expect(html).toContain('src="https://x.test/f/token/qr.png"')
  expect(html).toContain('alt="QR Platba"')
  expect(html).toContain('naskenujte v bankovní aplikaci')
  expect(html).not.toContain('data:image')
})

test('omits the QR when there is nothing to pay by transfer', async () => {
  const html = await render(InvoiceEmail({ ...base, qrUrl: null }))
  expect(html).not.toContain('qr.png')
  expect(html).not.toContain('QR Platba')
})
