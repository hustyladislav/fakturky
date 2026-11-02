import { Toaster } from '@fakturky/ui/components/sonner'
import { themeInitScript } from '@fakturky/ui/components/theme'
import appCss from '@fakturky/ui/globals.css?url'
import type { QueryClient } from '@tanstack/react-query'
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
  useRouter,
} from '@tanstack/react-router'
import { RegisterServiceWorker } from '@/components/pwa/register-sw'
import { cs } from '@/i18n/cs'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: `${cs.brand} — ${cs.meta.title}` },
      { name: 'description', content: cs.meta.description },
      { name: 'theme-color', content: '#F6F2EA', media: '(prefers-color-scheme: light)' },
      { name: 'theme-color', content: '#121310', media: '(prefers-color-scheme: dark)' },
      { property: 'og:type', content: 'website' },
      { property: 'og:locale', content: 'cs_CZ' },
      { property: 'og:site_name', content: cs.brand },
      { property: 'og:title', content: `${cs.brand} — ${cs.meta.title}` },
      { property: 'og:description', content: cs.meta.description },
      { property: 'og:image', content: '/og.png' },
      { name: 'twitter:card', content: 'summary_large_image' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
      { rel: 'icon', href: '/favicon-32.png', type: 'image/png', sizes: '32x32' },
      { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      { rel: 'manifest', href: '/site.webmanifest' },
    ],
  }),
  notFoundComponent: () => (
    <main className="mx-auto p-6 pt-16">
      <h1 className="text-xl font-medium">404</h1>
      <p className="text-muted-foreground">{cs.common.notFound}</p>
    </main>
  ),
  component: () => <Outlet />,
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  const nonce = useRouter().options.ssr?.nonce
  return (
    <html lang="cs" suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Toaster />
        <RegisterServiceWorker />
        <Scripts />
      </body>
    </html>
  )
}
