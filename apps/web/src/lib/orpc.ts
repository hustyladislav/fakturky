import type { Router } from '@fakturky/core/router'
import { type ClientLink, createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import type { RouterClient } from '@orpc/server'
import { createTanstackQueryUtils } from '@orpc/tanstack-query'
import { createIsomorphicFn } from '@tanstack/react-start'

type Client = RouterClient<Router>

/** SSR calls the router in-process; the browser goes through /api/rpc. */
const resolveLink = createIsomorphicFn()
  .server(
    (): ClientLink<object> => ({
      async call(path, input, options) {
        const { serverClient } = await import('../server/orpc-server')
        let target: unknown = serverClient
        for (const segment of path) target = (target as Record<string, unknown>)[segment]
        return (target as (i: unknown, o: unknown) => Promise<unknown>)(input, options)
      },
    }),
  )
  .client((): ClientLink<object> => new RPCLink({ url: () => `${window.location.origin}/api/rpc` }))

const link: ClientLink<object> = {
  call: (path, input, options) => resolveLink().call(path, input, options),
}

export const client: Client = createORPCClient(link)
export const orpc = createTanstackQueryUtils(client)
