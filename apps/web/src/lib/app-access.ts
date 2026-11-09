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
  client.removeQueries({ queryKey })
  void client.prefetchQuery(accessQuery)
}

/** A procedure refused this session, so the remembered pass is wrong. */
export function forgetAppAccessIfUnauthorized(client: QueryClient, error: unknown) {
  if ((error as { code?: unknown }).code === 'UNAUTHORIZED') client.removeQueries({ queryKey })
}
