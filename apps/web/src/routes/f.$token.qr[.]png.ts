import { createFileRoute } from '@tanstack/react-router'

/**
 * Payment QR as a hosted PNG for the invoice e-mail (Gmail and Outlook show neither SVG nor data: images).
 * Gated by the same unguessable token as the public page; it does not count as a view of the invoice.
 */
export const Route = createFileRoute('/f/$token/qr.png')({
  server: {
    handlers: {
      GET: async ({ params }: { params: { token: string } }) => {
        const { serverClient } = await import('@/server/orpc-server')
        try {
          const { contentBase64 } = await serverClient.public.qrPng({ token: params.token })
          return new Response(Buffer.from(contentBase64, 'base64'), {
            headers: {
              'content-type': 'image/png',
              'cache-control': 'private, max-age=300',
              'x-robots-tag': 'noindex',
            },
          })
        } catch {
          return new Response('Not found', { status: 404 })
        }
      },
    },
  },
})
