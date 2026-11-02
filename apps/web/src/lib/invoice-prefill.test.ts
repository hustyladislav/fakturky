import { expect, test, vi } from 'vitest'
import { onInvoicePrefill, setInvoicePrefill, takeInvoicePrefill } from './invoice-prefill'

const draft = { lines: [{ description: 'Práce', quantity: '1', unitPrice: '1000' }] }

test('a prefill is handed over exactly once', () => {
  setInvoicePrefill(draft)
  expect(takeInvoicePrefill()).toEqual(draft)
  expect(takeInvoicePrefill()).toBeNull()
})

test('an already-open form is notified when a prefill arrives', () => {
  const listener = vi.fn()
  const off = onInvoicePrefill(listener)
  setInvoicePrefill(draft)
  expect(listener).toHaveBeenCalledTimes(1)
  off()
  setInvoicePrefill(draft)
  expect(listener).toHaveBeenCalledTimes(1)
  takeInvoicePrefill()
})
