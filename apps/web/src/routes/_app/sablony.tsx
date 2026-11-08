import { EmptyState } from '@fakturky/ui/components/empty-state'
import { PageHeader } from '@fakturky/ui/components/page-header'
import { Skeleton } from '@fakturky/ui/components/skeleton'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { ErrorState } from '@/components/error-state'
import { TemplateList } from '@/components/templates/template-list'
import { cs } from '@/i18n/cs'
import { pageHead } from '@/lib/head'
import { orpc } from '@/lib/orpc'

export const Route = createFileRoute('/_app/sablony')({
  head: pageHead(cs.templates.title),
  // Plain validation (no zod): keeps the schema library out of the client bundle.
  validateSearch: (search: Record<string, unknown>): { opakovat?: string } => ({
    opakovat: typeof search.opakovat === 'string' && search.opakovat ? search.opakovat : undefined,
  }),
  component: Templates,
})

const t = cs.templates

function Templates() {
  const templates = useQuery(orpc.templates.list.queryOptions({ input: {} }))
  const rules = useQuery(orpc.recurring.list.queryOptions({ input: {} }))
  const { opakovat } = Route.useSearch()
  const activeRules = rules.data?.filter((r) => r.active).length ?? 0

  return (
    <div className="mx-auto max-w-[1200px] pb-20 sm:pb-0">
      <PageHeader
        title={t.title}
        subtitle={
          templates.data && rules.data ? t.subtitle(templates.data.length, activeRules) : undefined
        }
      />

      {templates.isError && <ErrorState onRetry={() => templates.refetch()} />}
      {rules.isError && <ErrorState onRetry={() => rules.refetch()} />}
      {(templates.isPending || (templates.data && rules.isPending)) && (
        <div aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex h-[3.75rem] items-center border-b">
              <Skeleton className="h-4 w-1/3" />
            </div>
          ))}
        </div>
      )}
      {templates.data?.length === 0 && (
        <EmptyState illustration="templates" title={t.emptyTitle}>
          {t.empty}
        </EmptyState>
      )}
      {templates.data && templates.data.length > 0 && !rules.isPending && (
        <TemplateList templates={templates.data} rules={rules.data} openRepeatFor={opakovat} />
      )}
    </div>
  )
}
