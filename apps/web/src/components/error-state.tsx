import { Button } from '@fakturky/ui/components/button'
import { EmptyState } from '@fakturky/ui/components/empty-state'
import { TriangleAlert } from 'lucide-react'
import { cs } from '@/i18n/cs'

/** Failed query: say so (never fall through to an "empty" state) and offer a retry. */
export function ErrorState({
  onRetry,
  title = cs.common.loadErrorTitle,
  className,
}: {
  onRetry: () => unknown
  title?: string
  className?: string
}) {
  return (
    <div role="alert">
      <EmptyState
        icon={TriangleAlert}
        title={title}
        className={className}
        action={
          <Button variant="outline" onClick={() => onRetry()}>
            {cs.common.retry}
          </Button>
        }
      >
        {cs.common.loadErrorText}
      </EmptyState>
    </div>
  )
}
