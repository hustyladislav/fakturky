import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/f/$token/pdf')({
  server: {
    handlers: {
      GET: async ({ params }: { params: { token: string } }) => {
        const [{ serverClient }, { pdfFromBase64 }] = await Promise.all([
          import('@/server/orpc-server'),
          import('@/server/pdf'),
        ])
        try {
          return pdfFromBase64(await serverClient.public.pdf({ token: params.token }))
        } catch {
          return new Response('Not found', { status: 404 })
        }
      },
    },
  },
})
