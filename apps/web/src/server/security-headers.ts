/**
 * HTTP hardening shared by the Nitro route rules (static headers on every response, assets included)
 * and the Start request middleware (per-request CSP nonce, tokenised public pages).
 * Pure functions only, so the policy is unit-tested.
 */

export const STATIC_SECURITY_HEADERS: Record<string, string> = {
  // Two years; no `preload` until the production domain is final (preloading is hard to undo).
  'strict-transport-security': 'max-age=63072000; includeSubDomains',
  'x-content-type-options': 'nosniff',
  // Legacy twin of CSP frame-ancestors for old browsers.
  'x-frame-options': 'DENY',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'cross-origin-opener-policy': 'same-origin',
  'permissions-policy': [
    'accelerometer=()',
    'camera=()',
    'geolocation=()',
    'gyroscope=()',
    'magnetometer=()',
    'microphone=()',
    'payment=()',
    'usb=()',
    // Passkeys must keep working on our own origin.
    'publickey-credentials-get=(self)',
    'publickey-credentials-create=(self)',
  ].join(', '),
}

export function generateNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return btoa(String.fromCharCode(...bytes))
}

/**
 * Nonce + `strict-dynamic` CSP: only scripts we render (or that those scripts load) execute,
 * so an injected `<script>`/event handler is inert. `style-src 'unsafe-inline'` is kept because React
 * `style=""` attributes and sonner inject styles at runtime (style injection cannot run code).
 */
export function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "manifest-src 'self'",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ')
}

/**
 * Pages whose URL carries a bearer-like token (`/f/:token`) must never leak it via Referer, into caches
 * or search indexes. Applied as a more specific Nitro route rule on top of the static headers.
 */
export const TOKEN_PATH_HEADERS: Record<string, string> = {
  ...STATIC_SECURITY_HEADERS,
  'referrer-policy': 'no-referrer',
  'x-robots-tag': 'noindex, nofollow, noarchive',
  'cache-control': 'private, no-store',
}
