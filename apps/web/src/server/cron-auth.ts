import { createHash, timingSafeEqual } from 'node:crypto'

/**
 * Cron routes are authorised with `Authorization: Bearer $CRON_SECRET` (Vercel Cron sends it).
 * Both sides are hashed first so the comparison is constant-time regardless of length, and an
 * unset or too-short secret never authorises anyone.
 */
export function isCronAuthorized(request: Request, secret = process.env.CRON_SECRET): boolean {
  if (!secret || secret.length < 16) return false
  const header = request.headers.get('authorization') ?? ''
  const digest = (v: string) => createHash('sha256').update(v).digest()
  return timingSafeEqual(digest(header), digest(`Bearer ${secret}`))
}
