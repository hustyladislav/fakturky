import { SignIn } from '@clerk/tanstack-react-start'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/prihlaseni/$')({
  component: () => (
    <main className="flex min-h-svh items-center justify-center p-6">
      <SignIn routing="path" path="/prihlaseni" signUpUrl="/registrace" />
    </main>
  ),
})
