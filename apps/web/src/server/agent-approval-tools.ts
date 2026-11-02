import { createServerFn } from '@tanstack/react-start'

/**
 * Descriptors of the server tools that need approval. The chat client must know them (same name and
 * input schema) to bind the server's approval interrupts to resolvable cards; it never executes them.
 */
export const getApprovalToolsFn = createServerFn({ method: 'GET' }).handler(async () => {
  const [{ listApprovalTools }, { getSessionFn }] = await Promise.all([
    import('./agent/tools'),
    import('./session'),
  ])
  // JSON text: the schemas are open-ended objects the server-function serializer cannot type.
  if (!(await getSessionFn())) return '[]'
  return JSON.stringify(listApprovalTools())
})
