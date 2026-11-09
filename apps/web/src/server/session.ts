import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'

async function readUser() {
  const { getRuntime } = await import('./runtime')
  const { auth } = await getRuntime()
  const session = await auth.api.getSession({ headers: getRequestHeaders() })
  return session
    ? { id: session.user.id, name: session.user.name, email: session.user.email }
    : null
}

/** Current user (or null) for route guards. Server-only body. */
export const getSessionFn = createServerFn({ method: 'GET' }).handler(async () => {
  const user = await readUser()
  return user ? { user } : null
})

/** Who may enter the app, in one call: the user, and whether their business profile is finished. */
export const getAppAccessFn = createServerFn({ method: 'GET' }).handler(async () => {
  const user = await readUser()
  if (!user) return null
  const { serverClient } = await import('./orpc-server')
  const profile = await serverClient.businessProfile.get()
  return { user, onboarded: Boolean(profile.onboardedAt) }
})
