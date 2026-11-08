import { describe, expect, test } from 'vitest'
import { undoPaidInput } from './undo-paid'

describe('undoPaidInput', () => {
  test('names only the newest payment, so earlier part-payments survive the undo', () => {
    const paid = { id: 'doc', payments: [{ id: 'earlier' }, { id: 'just-added' }] }
    expect(undoPaidInput(paid)).toEqual({ id: 'doc', paymentId: 'just-added' })
  })
})
