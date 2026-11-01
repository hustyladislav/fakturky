import { createFileRoute } from '@tanstack/react-router'

/** Authenticated PDF download (session cookie or API key). */
export const Route = createFileRoute('/api/documents/$id/pdf')({
  server: {
    handlers: {
      GET: async ({ request, params }: { request: Request; params: { id: string } }) => {
        const [{ documentsRepo }, { createContext }, { renderDocumentPdf, pdfResponse }] =
          await Promise.all([
            import('@fakturky/core/documents-repo'),
            import('@/server/context'),
            import('@/server/pdf'),
          ])
        const ctx = await createContext(request.headers)
        if (!ctx.principal) return new Response('Unauthorized', { status: 401 })
        const found = await documentsRepo.forExport(ctx.db, ctx.principal.organizationId, params.id)
        if (!found) return new Response('Not found', { status: 404 })
        return pdfResponse(await renderDocumentPdf(found.doc, found.lines), found.doc.number)
      },
    },
  },
})
