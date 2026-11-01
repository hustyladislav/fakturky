import { SignUp } from '@clerk/tanstack-react-start'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/registrace/$')({
  component: () => (
    <main className="flex min-h-svh items-center justify-center p-6">
      <SignUp routing="path" path="/registrace" signInUrl="/prihlaseni" />
    </main>
  ),
})
