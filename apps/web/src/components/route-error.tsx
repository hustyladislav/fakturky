import { type ErrorComponentProps, useRouter } from '@tanstack/react-router'
import { ErrorState } from '@/components/error-state'

/** A route whose loader failed. Invalidating re-runs the loader and resets this boundary. */
export function RouteError(_: ErrorComponentProps) {
  const router = useRouter()
  return <ErrorState onRetry={() => router.invalidate()} />
}
