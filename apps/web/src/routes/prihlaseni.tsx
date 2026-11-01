import { createFileRoute } from '@tanstack/react-router'
import { AuthForm } from '@/components/auth-form'

export const Route = createFileRoute('/prihlaseni')({
  component: () => <AuthForm mode="sign-in" />,
})
