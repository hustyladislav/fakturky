import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/faktury')({
  component: () => <Outlet />,
})
