import { AsyncLocalStorage } from 'node:async_hooks'

/** Per-request CSP nonce, readable by `getRouter()` (which hands it to TanStack's own inline scripts). */
export const nonceStore = new AsyncLocalStorage<string>()
