import { createFileRoute } from '@tanstack/react-router'

/** Thin download adapter over the `documents.pdf` procedure (session cookie or API key). */
export const Route = createFileRoute('/api/documents/$id/pdf')({
  server: {
    handlers: {
      GET: async ({ params }: { params: { id: string } }) => {
        const [{ serverClient }, { pdfFromBase64 }] = await Promise.all([
          import('@/server/orpc-server'),
          import('@/server/pdf'),
        ])
        try {
          return pdfFromBase64(await serverClient.documents.pdf({ id: params.id }))
        } catch (e) {
          const code = (e as { code?: string }).code
          if (code === 'UNAUTHORIZED') return new Response('Unauthorized', { status: 401 })
          return new Response('Not found', { status: 404 })
        }
      },
    },
  },
})
