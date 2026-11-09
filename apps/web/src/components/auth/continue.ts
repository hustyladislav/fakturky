/**
 * Where to send the user after any sign-in or sign-up when one was started on someone's behalf.
 * Re-entering /authorize re-validates the whole request, so nothing from the URL is trusted here.
 */
export function continueAfterAuth(search: string): string | null {
  const query = new URLSearchParams(search)
  if (query.get('client_id') && query.get('response_type')) {
    return `/api/auth/oauth2/authorize${search}`
  }
  return null
}
