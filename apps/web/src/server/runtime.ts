import { type Auth, createAuth } from '@fakturky/core/auth'
import { BRAND } from '@fakturky/core/brand'
import { createDb, type DbHandle, migrate } from '@fakturky/db'
import { tanstackStartCookies } from 'better-auth/tanstack-start'

import { deliverMagicLink } from './email'

type Runtime = { handle: DbHandle; auth: Auth }

let runtime: Promise<Runtime> | undefined

function baseURL(): string {
  return (
    process.env.BETTER_AUTH_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  )
}

function authSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET
  if (secret) return secret
  if (process.env.NODE_ENV === 'production') throw new Error('BETTER_AUTH_SECRET is required')
  return 'dev-only-secret-change-me-dev-only-secret'
}

/** Lazily-initialised singletons: database, auth. PGlite fallback when no DATABASE_URL (local dev). */
export function getRuntime(): Promise<Runtime> {
  runtime ??= (async () => {
    const url = process.env.DATABASE_URL
    const handle = await createDb({ url, pgliteDir: url ? undefined : '.data/pglite' })
    if (handle.kind === 'pglite') await migrate(handle)
    const auth = createAuth({
      db: handle.db,
      secret: authSecret(),
      baseURL: baseURL(),
      trustedOrigins: [
        baseURL(),
        ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
      ],
      google:
        process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
          ? {
              clientId: process.env.GOOGLE_CLIENT_ID,
              clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            }
          : undefined,
      // Only Vercel preview deployments need to proxy OAuth through production.
      oauthProxyProductionUrl:
        process.env.VERCEL_ENV === 'preview'
          ? (process.env.PRODUCTION_URL ?? BRAND.productionUrl)
          : undefined,
      sendMagicLink: deliverMagicLink,
      extraPlugins: [tanstackStartCookies()],
    })
    return { handle, auth }
  })().catch((error) => {
    runtime = undefined
    throw error
  })
  return runtime
}
