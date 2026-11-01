import { apiKeyClient } from '@better-auth/api-key/client'
import { dashClient } from '@better-auth/infra/client'
import { passkeyClient } from '@better-auth/passkey/client'
import { organizationClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient({
  plugins: [passkeyClient(), dashClient(), apiKeyClient(), organizationClient()],
})
