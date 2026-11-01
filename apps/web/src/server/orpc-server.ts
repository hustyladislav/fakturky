import { router } from '@fakturky/core/router'
import { createRouterClient } from '@orpc/server'
import { createContext } from './context'

/** In-process client used during SSR: no HTTP round trip, same router. */
export const serverClient = createRouterClient(router, {
  context: async () => createContext(),
})
