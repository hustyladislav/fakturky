import { expect, test } from 'vitest'
import { splitReceipt } from './receipt-split'

test('the two parts add up to the received amount exactly', () => {
  expect(splitReceipt('100.00', '33,33')).toEqual({ standard: '66.67', reduced: '33.33' })
  expect(splitReceipt('0.30', '0,10')).toEqual({ standard: '0.20', reduced: '0.10' })
})

test('accepts Czech number formatting', () => {
  expect(splitReceipt('20000.00', '12 345,50')).toEqual({
    standard: '7654.50',
    reduced: '12345.50',
  })
})

test.each(['', 'abc', '0', '100', '150', '-5', '0,125'])('rejects %j', (input) => {
  expect(splitReceipt('100.00', input)).toBeNull()
})
