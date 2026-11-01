import { expect, test } from 'vitest'
import {
  buildCsp,
  generateNonce,
  STATIC_SECURITY_HEADERS,
  TOKEN_PATH_HEADERS,
} from './security-headers'

test('CSP is nonce-based: no script unsafe-inline/eval, no framing, no plugins', () => {
  const nonce = generateNonce()
  const csp = buildCsp(nonce)
  const directives = Object.fromEntries(csp.split('; ').map((d) => [d.split(' ')[0], d]))
  expect(directives['script-src']).toContain(`'nonce-${nonce}'`)
  expect(directives['script-src']).toContain("'strict-dynamic'")
  expect(directives['script-src']).not.toMatch(/unsafe-(inline|eval)/)
  expect(directives['frame-ancestors']).toBe("frame-ancestors 'none'")
  expect(directives['object-src']).toBe("object-src 'none'")
  expect(directives['base-uri']).toBe("base-uri 'self'")
  expect(directives['default-src']).toBe("default-src 'self'")
})

test('nonces are unique and unguessable (128 bit)', () => {
  const seen = new Set(Array.from({ length: 200 }, generateNonce))
  expect(seen.size).toBe(200)
  expect(atob(generateNonce())).toHaveLength(16)
})

test('baseline headers cover HSTS, framing, sniffing, referrer and powerful features', () => {
  const h = STATIC_SECURITY_HEADERS
  expect(h['strict-transport-security']).toMatch(/max-age=\d{8,}/)
  expect(h['x-frame-options']).toBe('DENY')
  expect(h['x-content-type-options']).toBe('nosniff')
  expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin')
  expect(h['permissions-policy']).toContain('camera=()')
  expect(h['permissions-policy']).toContain('publickey-credentials-get=(self)')
})

test('tokenised public pages never leak the URL and are not indexed or cached', () => {
  expect(TOKEN_PATH_HEADERS['referrer-policy']).toBe('no-referrer')
  expect(TOKEN_PATH_HEADERS['x-robots-tag']).toContain('noindex')
  expect(TOKEN_PATH_HEADERS['cache-control']).toContain('no-store')
  expect(TOKEN_PATH_HEADERS['x-frame-options']).toBe('DENY')
})
