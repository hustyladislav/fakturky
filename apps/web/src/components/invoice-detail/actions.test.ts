import { describe, expect, it } from 'vitest'
import { type ActionInput, planActions } from './actions'

const base: ActionInput = {
  type: 'invoice',
  status: 'issued',
  displayStatus: 'issued',
  total: '1000.00',
  hasPublicLink: true,
  reached: false,
  related: [],
  vatPayer: true,
}
const plan = (o: Partial<ActionInput>) => planActions({ ...base, ...o })

describe('planActions', () => {
  it('draft: issue first, edit beside it, only delete in the menu', () => {
    const p = plan({ status: 'draft', displayStatus: 'draft', hasPublicLink: false })
    expect(p).toMatchObject({ primary: 'issue', secondary: ['edit'], more: ['delete'] })
  })

  it('fresh issued invoice: share first, pay as the quiet alternative', () => {
    const p = plan({})
    expect(p.primary).toBe('share')
    expect(p.secondary).toEqual(['pay', 'send', 'pdf'])
    expect(p.more).toEqual(['duplicate', 'template', 'credit', 'cancel'])
  })

  it('issued invoice already sent or viewed: pay first', () => {
    const p = plan({ reached: true })
    expect(p.primary).toBe('pay')
    expect(p.secondary).toEqual(['share', 'send', 'pdf'])
  })

  it('issued invoice without a public link: pay first and no share', () => {
    const p = plan({ hasPublicLink: false })
    expect(p.primary).toBe('pay')
    expect(p.secondary).not.toContain('share')
  })

  it('overdue: pay first and the send becomes a reminder', () => {
    const p = plan({ displayStatus: 'overdue' })
    expect(p.primary).toBe('pay')
    expect(p.sendIsReminder).toBe(true)
  })

  it('part-paid: getting paid stays primary', () => {
    expect(plan({ displayStatus: 'partially_paid' }).primary).toBe('pay')
  })

  it('paid invoice: PDF is primary, mark unpaid and credit note are in the menu', () => {
    const p = plan({ status: 'paid', displayStatus: 'paid' })
    expect(p.primary).toBe('pdf')
    expect(p.secondary).toEqual(['send'])
    expect(p.more).toEqual(['markUnpaid', 'duplicate', 'template', 'credit', 'cancel'])
  })

  it('paid zero-total invoice cannot be marked unpaid', () => {
    const p = plan({ status: 'paid', displayStatus: 'paid', total: '0.00' })
    expect(p.more).not.toContain('markUnpaid')
  })

  it('cancelled: nothing destructive left, PDF only', () => {
    const p = plan({ status: 'cancelled', displayStatus: 'cancelled' })
    expect(p.primary).toBe('pdf')
    expect(p.secondary).toEqual([])
    expect(p.more).toEqual(['duplicate', 'template'])
  })

  it('issued credit note: PDF primary, can be sent, cannot be paid or corrected', () => {
    const p = plan({ type: 'credit_note' })
    expect(p.primary).toBe('pdf')
    expect(p.secondary).toEqual(['send'])
    expect(p.more).not.toContain('credit')
  })

  it('paid proforma of a VAT payer: receipt first, final invoice waits for a paid receipt', () => {
    const paid = { type: 'proforma', status: 'paid', displayStatus: 'paid' }
    const p = plan(paid)
    expect(p.primary).toBe('receipt')
    expect(p.more).not.toContain('final')
    const withReceipt = plan({ ...paid, related: [{ type: 'payment_receipt', status: 'paid' }] })
    expect(withReceipt.primary).toBe('final')
  })

  it('paid proforma of a non-payer: final invoice straight away', () => {
    const p = plan({ type: 'proforma', status: 'paid', displayStatus: 'paid', vatPayer: false })
    expect(p.primary).toBe('final')
    expect(p.more).not.toContain('receipt')
  })

  it('paid proforma before the profile loaded: no receipt or final yet', () => {
    const p = plan({ type: 'proforma', status: 'paid', displayStatus: 'paid', vatPayer: undefined })
    expect(p.primary).toBe('pdf')
    expect(p.more).not.toContain('final')
    expect(p.more).not.toContain('receipt')
  })

  it('issued proforma: pay and share like an invoice, no credit note', () => {
    const p = plan({ type: 'proforma' })
    expect(p.primary).toBe('share')
    expect(p.more).not.toContain('credit')
  })
})
