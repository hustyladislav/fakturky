import { createFileRoute } from '@tanstack/react-router'
import { AuthForm } from '@/components/auth-form'
import { cs } from '@/i18n/cs'
import { pageHead } from '@/lib/head'

export const Route = createFileRoute('/registrace')({
  head: pageHead(cs.auth.signUpTitle),
  component: () => <AuthForm mode="sign-up" />,
})
