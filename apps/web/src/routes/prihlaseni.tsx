import { createFileRoute } from '@tanstack/react-router'
import { AuthForm } from '@/components/auth/auth-form'
import { cs } from '@/i18n/cs'
import { pageHead } from '@/lib/head'

export const Route = createFileRoute('/prihlaseni')({
  head: pageHead(cs.auth.signInTitle),
  component: () => <AuthForm mode="sign-in" />,
})
