import { ORPCError } from '@orpc/client'
import type { QueryClient } from '@tanstack/react-query'
import { redirect } from '@tanstack/react-router'
import { getAppAccessFn } from '@/server/session'

const queryKey = ['app-access']
/** How long a tab trusts its last check before the next click asks the server again. */
const TRUSTED_MS = 5 * 60_000
const accessQuery = { queryKey, queryFn: () => getAppAccessFn(), staleTime: TRUSTED_MS }

/**
 * The gate in front of every app page. A pass is remembered so switching pages costs no server call;
 * each procedure still authorises its own request. A refusal is never remembered: signing in and
 * finishing onboarding change the answer.
 */
export async function requireAppAccess(client: QueryClient) {
  const access = await client.fetchQuery(accessQuery)
  if (access?.onboarded) return access.user
  client.removeQueries({ queryKey })
  throw redirect({ to: access ? '/onboarding' : '/prihlaseni' })
}

/** Another tab may have switched accounts meanwhile; ask now so the next click already knows. */
export function recheckAppAccess(client: QueryClient) {
  // A check on its way answers this too; removing it would cancel the navigation waiting for it.
  if (client.isFetching({ queryKey })) return
  client.removeQueries({ queryKey })
  void client.prefetchQuery(accessQuery)
}

export const SESSION_REFUSED_EVENT = 'app-access:session-refused'

/** For the API client: every call passes through it, whoever handles the error afterwards. */
export function reportIfSessionRefused(error: unknown) {
  if (error instanceof ORPCError && error.code === 'UNAUTHORIZED')
    window.dispatchEvent(new Event(SESSION_REFUSED_EVENT))
}
