import { QueryClient } from '@tanstack/react-query'
import { createRouter } from '@tanstack/react-router'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import { createIsomorphicFn } from '@tanstack/react-start'
import { RouteError } from '@/components/route-error'
import { createMutationCache } from '@/lib/mutation-errors'
import { routeTree } from './routeTree.gen'
import { nonceStore } from './server/nonce'

/** CSP nonce of the current SSR request (set by the request middleware in `start.ts`); none on the client. */
const requestNonce = createIsomorphicFn()
  .server(() => nonceStore.getStore())
  .client(() => undefined)

export function getRouter() {
  const queryClient = new QueryClient({
    mutationCache: createMutationCache(),
    // One quick retry, then show the error state (the default 3 retries leave skeletons up for ~7 s offline).
    defaultOptions: { queries: { staleTime: 30_000, retry: 1, retryDelay: 1000 } },
  })
  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: RouteError,
    // Cross-fade + 8 px slide of the content area (`vt-page`); a no-op where unsupported or reduced motion.
    defaultViewTransition: true,
    ssr: { nonce: requestNonce() },
  })
  setupRouterSsrQueryIntegration({ router, queryClient })
  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
