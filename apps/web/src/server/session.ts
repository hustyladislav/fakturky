import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'

/** Current user (or null) for route guards. Server-only body. */
export const getSessionFn = createServerFn({ method: 'GET' }).handler(async () => {
  const { getRuntime } = await import('./runtime')
  const { auth } = await getRuntime()
  const session = await auth.api.getSession({ headers: getRequestHeaders() })
  return session
    ? { user: { id: session.user.id, name: session.user.name, email: session.user.email } }
    : null
})
