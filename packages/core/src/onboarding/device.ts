import type { Db } from '@fakturky/db'
import { schema } from '@fakturky/db'
import { APIError } from 'better-auth/api'
import { eq } from 'drizzle-orm'
import { type Auth, principalForUser } from '../auth'

const GRANT = 'urn:ietf:params:oauth:grant-type:device_code'

export type DeviceTokenResult =
  | { ok: true; apiKey: string; organizationName: string }
  | { ok: false; status: number; error: string }

/**
 * The poll behind the device login. The session the grant creates is swapped for an API key and
 * deleted straight away, so a device only ever holds the one credential the user can see and revoke.
 */
export async function redeemDeviceCode(
  auth: Auth,
  db: Db,
  input: { deviceCode: string; clientId: string },
  today = new Date().toISOString().slice(0, 10),
): Promise<DeviceTokenResult> {
  let token: string
  try {
    const granted = await auth.api.deviceToken({
      body: { grant_type: GRANT, device_code: input.deviceCode, client_id: input.clientId },
    })
    token = granted.access_token
  } catch (error) {
    if (!(error instanceof APIError)) throw error
    const code = (error.body as { error?: string } | undefined)?.error
    return { ok: false, status: 400, error: code ?? 'invalid_grant' }
  }

  const ctx = await auth.$context
  try {
    const session = await ctx.internalAdapter.findSession(token)
    const principal = session ? await principalForUser(db, session.user.id, 'apiKey') : null
    if (!session || !principal) return { ok: false, status: 400, error: 'invalid_grant' }
    const created = await auth.api.createApiKey({
      body: {
        name: `AI asistent ${today}`,
        userId: session.user.id,
        organizationId: principal.organizationId,
      },
    })
    const [org] = await db
      .select({ name: schema.organization.name })
      .from(schema.organization)
      .where(eq(schema.organization.id, principal.organizationId))
    return { ok: true, apiKey: created.key, organizationName: org?.name ?? '' }
  } finally {
    await ctx.internalAdapter.deleteSession(token)
  }
}
