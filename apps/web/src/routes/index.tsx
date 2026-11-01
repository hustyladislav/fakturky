import { createFileRoute, redirect } from '@tanstack/react-router'
import { Landing } from '@/components/marketing/landing'
import { cs } from '@/i18n/cs'
import { getSessionFn } from '@/server/session'

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    if (await getSessionFn()) throw redirect({ to: '/prehled' })
  },
  head: () => ({
    meta: [
      { title: cs.landing.metaTitle },
      { name: 'description', content: cs.landing.metaDescription },
      { property: 'og:title', content: cs.landing.metaTitle },
      { property: 'og:description', content: cs.landing.metaDescription },
    ],
  }),
  component: Landing,
})
