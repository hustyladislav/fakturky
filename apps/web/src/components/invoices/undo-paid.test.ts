import { describe, expect, test } from 'vitest'
import { undoPaidInput } from './undo-paid'

describe('undoPaidInput', () => {
  test('names the payment recorded last, so earlier part-payments survive the undo', () => {
    const paid = {
      id: 'doc',
      payments: [
        { id: 'earlier', createdAt: new Date('2026-11-01T10:00:00Z') },
        { id: 'just-added', createdAt: new Date('2026-11-08T10:00:00Z') },
      ],
    }
    expect(undoPaidInput(paid)).toEqual({ id: 'doc', paymentId: 'just-added' })
  })

  test('ignores list order: an imported payment dated in the future sorts after the new one', () => {
    const paid = {
      id: 'doc',
      payments: [
        { id: 'just-added', createdAt: new Date('2026-11-08T10:00:00Z') },
        { id: 'imported-future-dated', createdAt: new Date('2026-11-01T10:00:00Z') },
      ],
    }
    expect(undoPaidInput(paid)).toEqual({ id: 'doc', paymentId: 'just-added' })
  })
})
