import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/f/$token/isdoc')({
  server: {
    handlers: {
      GET: async ({ params }: { params: { token: string } }) => {
        const [
          { generateIsdoc },
          { toDocumentForExport },
          { publicDocumentsRepo },
          { getRuntime },
        ] = await Promise.all([
          import('@fakturky/domain'),
          import('@fakturky/core/export'),
          import('@fakturky/core/public-documents'),
          import('@/server/runtime'),
        ])
        const { handle } = await getRuntime()
        const found = await publicDocumentsRepo.getByToken(handle.db, params.token)
        if (!found) return new Response('Not found', { status: 404 })
        const xml = generateIsdoc(toDocumentForExport(found.doc, found.lines))
        return new Response(xml, {
          headers: {
            'content-type': 'application/xml; charset=utf-8',
            'content-disposition': `attachment; filename="${found.doc.number ?? 'faktura'}.isdoc"`,
            'x-robots-tag': 'noindex, nofollow',
            'cache-control': 'private, no-store',
          },
        })
      },
    },
  },
})
