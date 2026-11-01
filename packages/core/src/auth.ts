import { apiKey } from '@better-auth/api-key'
import { passkey } from '@better-auth/passkey'
import { type Db, newId, schema } from '@fakturky/db'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { organization } from 'better-auth/plugins'
import { eq } from 'drizzle-orm'
import { BRAND } from './brand'
import type { Principal } from './context'

export type CreateAuthOptions = {
  db: Db
  secret: string
  baseURL: string
  /** Extra plugins; `tanstackStartCookies()` must be last, so the web app appends it. */
  extraPlugins?: unknown[]
  trustedOrigins?: string[]
}

function slugify(input: string): string {
  const base = input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `${base || 'firma'}-${newId().slice(-8)}`
}

export function createAuth(options: CreateAuthOptions) {
  const { db } = options
  const url = new URL(options.baseURL)

  return betterAuth({
    appName: BRAND.name,
    baseURL: options.baseURL,
    secret: options.secret,
    trustedOrigins: options.trustedOrigins,
    database: drizzleAdapter(db, { provider: 'pg', schema }),
    advanced: { database: { generateId: () => newId() } },
    emailAndPassword: { enabled: true, minPasswordLength: 8 },
    databaseHooks: {
      user: {
        create: {
          // First sign-up: every user gets a personal organization + empty business profile.
          after: async (user) => {
            await db.transaction(async (tx) => {
              const [org] = await tx
                .insert(schema.organization)
                .values({ name: user.name, slug: slugify(user.name) })
                .returning({ id: schema.organization.id })
              if (!org) throw new Error('organization insert failed')
              await tx
                .insert(schema.member)
                .values({ organizationId: org.id, userId: user.id, role: 'owner' })
              await tx
                .insert(schema.businessProfile)
                .values({ organizationId: org.id, legalName: user.name })
            })
          },
        },
      },
      session: {
        create: {
          before: async (session) => {
            const [m] = await db
              .select({ organizationId: schema.member.organizationId })
              .from(schema.member)
              .where(eq(schema.member.userId, session.userId))
              .limit(1)
            return { data: { ...session, activeOrganizationId: m?.organizationId ?? null } }
          },
        },
      },
    },
    plugins: [
      organization(),
      passkey({ rpID: url.hostname, rpName: BRAND.name, origin: url.origin }),
      apiKey({ references: 'organization', defaultPrefix: BRAND.apiKeyPrefix }),
      ...((options.extraPlugins ?? []) as never[]),
    ],
  })
}

export type Auth = ReturnType<typeof createAuth>

/**
 * Resolve the caller from a request: session cookie first, then an API key
 * (`Authorization: Bearer fk_…` or `x-api-key`). Returns null when anonymous.
 */
export async function resolvePrincipal(
  auth: Auth,
  db: Db,
  headers: Headers,
): Promise<Principal | null> {
  const session = await auth.api.getSession({ headers })
  if (session) {
    // The sign-up session is created before the organization hook finishes, so fall back to membership.
    const organizationId =
      session.session.activeOrganizationId ??
      (
        await db
          .select({ organizationId: schema.member.organizationId })
          .from(schema.member)
          .where(eq(schema.member.userId, session.user.id))
          .limit(1)
      )[0]?.organizationId
    if (organizationId) return { userId: session.user.id, organizationId, via: 'session' }
  }

  const bearer = headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
  const key = headers.get('x-api-key') ?? bearer
  if (key?.startsWith(BRAND.apiKeyPrefix)) {
    const result = await auth.api.verifyApiKey({ body: { key } })
    const k = result.valid ? result.key : null
    if (k?.referenceId) {
      return { userId: k.referenceId, organizationId: k.referenceId, via: 'apiKey' }
    }
  }
  return null
}
