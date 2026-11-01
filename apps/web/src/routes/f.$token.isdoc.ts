import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/f/$token/isdoc')({
  server: {
    handlers: {
      GET: async ({ params }: { params: { token: string } }) => {
        const { serverClient } = await import('@/server/orpc-server')
        try {
          const { filename, xml } = await serverClient.public.isdoc({ token: params.token })
          return new Response(xml, {
            headers: {
              'content-type': 'application/xml; charset=utf-8',
              'content-disposition': `attachment; filename="${filename}"`,
              'x-robots-tag': 'noindex, nofollow',
              'cache-control': 'private, no-store',
            },
          })
        } catch {
          return new Response('Not found', { status: 404 })
        }
      },
    },
  },
})
