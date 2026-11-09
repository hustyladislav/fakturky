import { createFileRoute } from '@tanstack/react-router'

/** The poll of the device login: `authorization_pending` until the user approves, then an API key. */
export const Route = createFileRoute('/api/device/token')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => null)) as {
          device_code?: unknown
          client_id?: unknown
        } | null
        if (typeof body?.device_code !== 'string' || typeof body.client_id !== 'string') {
          return Response.json({ error: 'invalid_request' }, { status: 400 })
        }
        const [{ redeemDeviceCode }, { getRuntime }] = await Promise.all([
          import('@fakturky/core/onboarding'),
          import('@/server/runtime'),
        ])
        const { auth, handle: db } = await getRuntime()
        const result = await redeemDeviceCode(auth, db.db, {
          deviceCode: body.device_code,
          clientId: body.client_id,
        })
        const headers = { 'cache-control': 'no-store' }
        return result.ok
          ? Response.json(
              { api_key: result.apiKey, organization_name: result.organizationName },
              { headers },
            )
          : Response.json({ error: result.error }, { status: result.status, headers })
      },
    },
  },
})
