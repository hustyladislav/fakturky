import { resolvePrincipal } from '@fakturky/core/auth'
import type { BaseContext } from '@fakturky/core/context'
import { deliverInvoice, publicBaseUrl } from './email'
import { getRuntime } from './runtime'

export async function createContext(headers: Headers): Promise<BaseContext> {
  const { handle, auth } = await getRuntime()
  return {
    db: handle.db,
    principal: await resolvePrincipal(auth, handle.db, headers),
    services: {
      // Loaded on first use: a cold start for a plain read must not pay for the PDF renderer.
      renderPdf: async (...args) => (await import('./pdf')).renderDocumentPdf(...args),
      sendInvoice: deliverInvoice,
      publicBaseUrl: publicBaseUrl(headers),
    },
  }
}
