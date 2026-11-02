import { randomBytes } from 'node:crypto'
import { expect, test } from 'vitest'
import { CryptoError, decryptSecret, encryptSecret } from './crypto'

const key = randomBytes(32).toString('base64')

test('round-trips and never repeats the ciphertext', () => {
  const a = encryptSecret('fio-token-123', key)
  const b = encryptSecret('fio-token-123', key)
  expect(a).not.toBe(b)
  expect(a).not.toContain('fio-token-123')
  expect(decryptSecret(a, key)).toBe('fio-token-123')
})

test('wrong key, tampering and a missing key fail closed', () => {
  const enc = encryptSecret('secret', key)
  expect(() => decryptSecret(enc, randomBytes(32).toString('base64'))).toThrow(CryptoError)
  const [v, iv, tag, ct] = enc.split('.')
  const flipped = `${ct?.[0] === 'A' ? 'B' : 'A'}${ct?.slice(1)}`
  expect(() => decryptSecret([v, iv, tag, flipped].join('.'), key)).toThrow(CryptoError)
  expect(() => decryptSecret('garbage', key)).toThrow(CryptoError)
  expect(() => encryptSecret('x', undefined)).toThrow(CryptoError)
  expect(() => encryptSecret('x', 'c2hvcnQ=')).toThrow(CryptoError)
})
