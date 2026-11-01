import { ORPCError } from '@orpc/server'

/**
 * Protection for procedures that proxy third-party services (ARES, ČNB, VIES): an in-process TTL cache
 * (so repeated lookups never reach the upstream) and a per-caller fixed-window limiter. Both are per
 * serverless instance, i.e. a best-effort brake; the hard limit belongs in the Vercel Firewall.
 */

const MAX_ENTRIES = 500

type Entry<T> = { value: Promise<T>; expires: number }
const cache = new Map<string, Entry<unknown>>()

/** Resolve through the cache; concurrent identical calls share one upstream request. Errors are not cached. */
export function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const now = Date.now()
  const hit = cache.get(key) as Entry<T> | undefined
  if (hit && hit.expires > now) return hit.value
  const value = load()
  cache.set(key, { value, expires: now + ttlMs })
  value.catch(() => {
    if (cache.get(key)?.value === value) cache.delete(key)
  })
  if (cache.size > MAX_ENTRIES) {
    for (const [k, e] of cache) {
      if (e.expires <= now || cache.size > MAX_ENTRIES) cache.delete(k)
      if (cache.size <= MAX_ENTRIES * 0.8) break
    }
  }
  return value
}

type Window = { start: number; count: number }
const windows = new Map<string, Window>()

/** Throws TOO_MANY_REQUESTS once `limit` calls per `windowMs` are exceeded for `key`. */
export function enforceRateLimit(key: string, limit: number, windowMs = 60_000): void {
  const now = Date.now()
  const w = windows.get(key)
  if (!w || now - w.start >= windowMs) {
    windows.set(key, { start: now, count: 1 })
    if (windows.size > MAX_ENTRIES * 4) {
      for (const [k, v] of windows) if (now - v.start >= windowMs) windows.delete(k)
    }
    return
  }
  w.count++
  if (w.count > limit) {
    throw new ORPCError('TOO_MANY_REQUESTS', {
      message: 'Too many lookups, try again in a minute',
      data: { retryAfterSeconds: Math.ceil((w.start + windowMs - now) / 1000) },
    })
  }
}

/** Test helper. */
export function resetUpstreamGuard() {
  cache.clear()
  windows.clear()
}
