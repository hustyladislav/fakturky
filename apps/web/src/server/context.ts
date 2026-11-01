import { auth, clerkClient } from '@clerk/tanstack-react-start/server'
import type { BaseContext, Principal } from '@fakturky/core/context'
import { ensureOrganization } from '@fakturky/core/organizations'
import { getDb } from './runtime'

/**
 * Resolve the caller through Clerk: a browser session, or an API key / machine token
 * (`Authorization: Bearer …`). The Clerk organization id is our `organization_id`.
 */
export async function resolvePrincipal(): Promise<Principal | null> {
  const a = await auth({ acceptsToken: ['session_token', 'api_key'] })
  if (!a.isAuthenticated) return null
  const orgId = 'orgId' in a ? a.orgId : null
  if (!orgId) return null
  const userId =
    'userId' in a && a.userId ? a.userId : String(('subject' in a && a.subject) || orgId)
  return {
    userId,
    organizationId: orgId,
    via: a.tokenType === 'session_token' ? 'session' : 'apiKey',
  }
}

export async function createContext(): Promise<BaseContext> {
  const db = await getDb()
  const principal = await resolvePrincipal()
  if (principal) {
    await ensureOrganization(db, {
      id: principal.organizationId,
      name: async () => {
        const org = await clerkClient().organizations.getOrganization({
          organizationId: principal.organizationId,
        })
        return org.name
      },
    })
  }
  return { db, principal }
}
