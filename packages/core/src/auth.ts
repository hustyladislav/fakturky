import { apiKey } from '@better-auth/api-key'
import { cimd } from '@better-auth/cimd'
import { fetchClientMetadataResource } from '@better-auth/cimd/node'
import { dash } from '@better-auth/infra'
import { mcp } from '@better-auth/mcp'
import { passkey } from '@better-auth/passkey'
import { type Db, newId, schema } from '@fakturky/db'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { jwt, magicLink, oAuthProxy, organization } from 'better-auth/plugins'
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
  /** Google sign-in; omitted when the credentials are not configured. */
  google?: { clientId: string; clientSecret: string }
  /**
   * Preview deployments have random URLs Google doesn't know: when set, OAuth callbacks go through
   * this (production) URL and are proxied back.
   */
  oauthProxyProductionUrl?: string
  /** Delivers the magic link; throw to signal that email is unavailable. */
  /** Transport for Client ID Metadata Documents; defaults to the SSRF-hardened Node fetcher. */
  fetchClientMetadata?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  sendMagicLink?: (message: { email: string; url: string }) => Promise<void>
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

/** OAuth scope an MCP client must hold to call tools. */
export const MCP_SCOPE = 'mcp:tools'

/** Canonical MCP resource URL for a deployment: the OAuth audience of access tokens. */
export const mcpResource = (baseURL: string) => `${new URL(baseURL).origin}/mcp`

export function createAuth(options: CreateAuthOptions) {
  const { db } = options
  const url = new URL(options.baseURL)

  return betterAuth({
    appName: BRAND.name,
    baseURL: options.baseURL,
    secret: options.secret,
    trustedOrigins: options.trustedOrigins,
    database: drizzleAdapter(db, { provider: 'pg', schema }),
    advanced: {
      database: { generateId: () => newId(), joins: true },
      // Cookies: Secure on https (production + previews), never readable by scripts.
      useSecureCookies: url.protocol === 'https:',
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax' },
      // Vercel sets both headers at the edge; they cannot be spoofed by the client.
      ipAddress: { ipAddressHeaders: ['x-real-ip', 'x-forwarded-for'] },
    },
    socialProviders: options.google
      ? {
          google: {
            ...options.google,
            ...(options.oauthProxyProductionUrl
              ? { redirectURI: `${options.oauthProxyProductionUrl}/api/auth/callback/google` }
              : {}),
          },
        }
      : {},
    // OAuth provider mode: the plugin's own /token and set-auth-jwt header must be off.
    disabledPaths: ['/token'],
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      // A password reset must kick out whoever held the old password.
      revokeSessionsOnPasswordReset: true,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 14,
      updateAge: 60 * 60 * 24,
      // Sensitive changes (password, API keys, ...) require a login younger than this.
      freshAge: 60 * 15,
    },
    // Serverless instances do not share memory, so counters live in the database (`rate_limit` table).
    // Enabled explicitly (Better Auth defaults to production only); the tight rules are for credential endpoints.
    rateLimit: {
      enabled: true,
      storage: 'database',
      window: 60,
      max: 100,
      customRules: {
        '/sign-in/email': { window: 60, max: 5 },
        '/sign-up/email': { window: 3600, max: 10 },
        '/sign-in/magic-link': { window: 600, max: 5 },
        '/request-password-reset': { window: 3600, max: 5 },
        '/reset-password': { window: 3600, max: 10 },
        '/passkey/generate-authenticate-options': { window: 60, max: 20 },
        '/passkey/verify-authentication': { window: 60, max: 10 },
      },
    },
    databaseHooks: {
      user: {
        create: {
          // Magic-link / social sign-ups may arrive without a name.
          before: async (user) => ({
            data: { ...user, name: user.name?.trim() || user.email.split('@')[0] || user.email },
          }),
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
      apiKey({
        references: 'organization',
        defaultPrefix: BRAND.apiKeyPrefix,
        // Generous per-key limit (the plugin default is 10 requests per day).
        rateLimit: { enabled: true, timeWindow: 60_000, maxRequests: 600 },
      }),
      dash(),
      jwt({ disableSettingJwtHeader: true }),
      mcp({
        loginPage: '/prihlaseni',
        consentPage: '/souhlas',
        resource: mcpResource(options.baseURL),
        scopes: ['openid', 'profile', 'email', 'offline_access', MCP_SCOPE],
      }),
      cimd({
        fetchClientMetadataResource: options.fetchClientMetadata ?? fetchClientMetadataResource,
        metadataProfile: 'mcp-2026-07-28',
      }),
      ...(options.sendMagicLink
        ? [
            magicLink({
              expiresIn: 300,
              sendMagicLink: async ({ email, url }) => options.sendMagicLink?.({ email, url }),
            }),
          ]
        : []),
      ...(options.oauthProxyProductionUrl
        ? [oAuthProxy({ productionURL: options.oauthProxyProductionUrl })]
        : []),
      ...((options.extraPlugins ?? []) as never[]),
    ],
  })
}

export type Auth = ReturnType<typeof createAuth>

/**
 * Resolve the caller from a request: session cookie first, then an API key
 * (`Authorization: Bearer fk_…` or `x-api-key`). Returns null when anonymous.
 */
/** Organization a user acts on: the preferred one if they are still a member, else their first. */
export async function principalForUser(
  db: Db,
  userId: string,
  via: Principal['via'],
  preferredOrganizationId?: string | null,
): Promise<Principal | null> {
  // Never trust a stored organization alone: membership may have been revoked since.
  const memberships = await db
    .select({ organizationId: schema.member.organizationId })
    .from(schema.member)
    .where(eq(schema.member.userId, userId))
    // Deterministic fallback: the user's oldest membership (their personal organization).
    .orderBy(schema.member.createdAt, schema.member.id)
  const organizationId =
    memberships.find((m) => m.organizationId === preferredOrganizationId)?.organizationId ??
    memberships[0]?.organizationId
  return organizationId ? { userId, organizationId, via } : null
}

export async function resolvePrincipal(
  auth: Auth,
  db: Db,
  headers: Headers,
): Promise<Principal | null> {
  // An explicit API key wins over ambient session cookies (e.g. API docs opened while signed in);
  // an invalid key never falls back to the session.
  const bearer = headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
  const key = headers.get('x-api-key') ?? bearer
  if (key?.startsWith(BRAND.apiKeyPrefix)) {
    const result = await auth.api.verifyApiKey({ body: { key } })
    const k = result.valid ? result.key : null
    return k?.referenceId
      ? { userId: k.referenceId, organizationId: k.referenceId, via: 'apiKey' }
      : null
  }

  const session = await auth.api.getSession({ headers })
  if (session) {
    return principalForUser(db, session.user.id, 'session', session.session.activeOrganizationId)
  }

  return null
}
