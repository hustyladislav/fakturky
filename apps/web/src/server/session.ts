import { auth } from '@clerk/tanstack-react-start/server'
import { createServerFn } from '@tanstack/react-start'

/** Auth state for route guards. */
export const getAuthStateFn = createServerFn({ method: 'GET' }).handler(async () => {
  const { userId, orgId } = await auth()
  return { userId: userId ?? null, orgId: orgId ?? null }
})
