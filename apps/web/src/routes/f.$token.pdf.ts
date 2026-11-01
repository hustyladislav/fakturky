import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/f/$token/pdf')({
  server: {
    handlers: {
      GET: async ({ params }: { params: { token: string } }) => {
        const [{ publicDocumentsRepo }, { getRuntime }, { renderDocumentPdf, pdfResponse }] =
          await Promise.all([
            import('@fakturky/core/public-documents'),
            import('@/server/runtime'),
            import('@/server/pdf'),
          ])
        const { handle } = await getRuntime()
        const found = await publicDocumentsRepo.getByToken(handle.db, params.token)
        if (!found) return new Response('Not found', { status: 404 })
        return pdfResponse(await renderDocumentPdf(found.doc, found.lines), found.doc.number)
      },
    },
  },
})
