import { resolvePrincipal } from '@fakturky/core/auth'
import type { BaseContext } from '@fakturky/core/context'
import { getRuntime } from './runtime'

export async function createContext(headers: Headers): Promise<BaseContext> {
  const { handle, auth } = await getRuntime()
  const [{ renderDocumentPdf }, { deliverInvoice, publicBaseUrl }] = await Promise.all([
    import('./pdf'),
    import('./email'),
  ])
  return {
    db: handle.db,
    principal: await resolvePrincipal(auth, handle.db, headers),
    services: {
      renderPdf: renderDocumentPdf,
      sendInvoice: deliverInvoice,
      publicBaseUrl: publicBaseUrl(headers),
    },
  }
}
