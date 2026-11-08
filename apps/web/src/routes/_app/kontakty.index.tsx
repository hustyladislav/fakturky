import { EmptyState } from '@fakturky/ui/components/empty-state'
import { Input } from '@fakturky/ui/components/input'
import { PageHeader } from '@fakturky/ui/components/page-header'
import { Skeleton } from '@fakturky/ui/components/skeleton'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { NewContact } from '@/components/contacts/contact-dialogs'
import { ContactList } from '@/components/contacts/contact-list'
import { CsvDownload } from '@/components/csv-download'
import { crowns } from '@/components/invoices/summary-strip'
import { cs } from '@/i18n/cs'
import { pageHead } from '@/lib/head'
import { orpc } from '@/lib/orpc'

export const Route = createFileRoute('/_app/kontakty/')({
  head: pageHead(cs.contacts.title),
  validateSearch: (search: Record<string, unknown>): { novy?: boolean } =>
    search.novy === true || search.novy === 'true' ? { novy: true } : {},
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(orpc.contacts.list.queryOptions({ input: {} })),
  component: Contacts,
})

const t = cs.contacts

function Contacts() {
  const { novy } = Route.useSearch()
  const navigate = useNavigate()
  const list = useQuery(orpc.contacts.list.queryOptions({ input: {} }))
  const stats = useQuery(orpc.contacts.stats.queryOptions({ input: {} }))
  const [term, setTerm] = useState('')
  const clearNovy = useCallback(() => {
    void navigate({ to: '/kontakty', search: {}, replace: true })
  }, [navigate])

  const matches = useMemo(() => {
    const q = term.trim().toLowerCase()
    return (list.data ?? []).filter(
      (c) => !q || c.name.toLowerCase().includes(q) || (c.ico ?? '').includes(q),
    )
  }, [list.data, term])

  const totalOutstanding = (stats.data ?? []).reduce((n, s) => n + Number(s.outstanding), 0)
  const subtitle = list.data
    ? t.subtitle(
        list.data.length,
        totalOutstanding > 0 ? crowns(totalOutstanding.toFixed(2)) : null,
      )
    : undefined

  return (
    <div className="@container mx-auto max-w-[1200px]">
      <PageHeader
        title={t.title}
        subtitle={subtitle}
        actions={
          <>
            <CsvDownload kind="contacts" />
            <NewContact openOnMount={novy} onOpened={clearNovy} />
          </>
        }
      />

      {list.data?.length === 0 ? (
        <EmptyState illustration="contacts" title={t.emptyTitle}>
          {t.empty}
        </EmptyState>
      ) : (
        <>
          <div className="relative mb-2 sm:w-80">
            <Search
              className="absolute top-2.5 left-2.5 size-4 text-muted-foreground pointer-coarse:top-3.5"
              aria-hidden
            />
            <Input
              className="pl-8"
              placeholder={t.search}
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              aria-label={cs.common.search}
            />
          </div>

          {list.isPending ? (
            <div aria-busy="true">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="flex h-[3.75rem] items-center border-b">
                  <Skeleton className="h-4 w-1/3" />
                </div>
              ))}
            </div>
          ) : matches.length === 0 ? (
            <EmptyState illustration="search" title={t.noMatch} />
          ) : (
            <ContactList contacts={matches} stats={stats.data} />
          )}
        </>
      )}
    </div>
  )
}
