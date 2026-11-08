import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { groupByMonth } from '@/lib/invoice-groups'
import { orpc } from '@/lib/orpc'
import type { Doc } from './invoice-rows'
import type { ListSearch } from './list-search'

const PAGE = 100

/** Stats + paged documents for the current search, shaped into month groups when sorted by issue date. */
export function useInvoiceList({
  filter = 'all',
  q,
  type,
  sort = 'issueDate',
  dir = 'desc',
}: ListSearch) {
  const stats = useQuery({
    ...orpc.documents.stats.queryOptions({ input: { search: q || undefined, type } }),
    placeholderData: keepPreviousData,
  })
  const list = useInfiniteQuery({
    ...orpc.documents.list.infiniteOptions({
      input: (offset: number) => ({
        filter,
        search: q || undefined,
        type,
        sort,
        dir,
        limit: PAGE,
        offset,
      }),
      initialPageParam: 0,
      getNextPageParam: (last, all) =>
        last.length === PAGE ? all.reduce((n, p) => n + p.length, 0) : undefined,
    }),
    placeholderData: keepPreviousData,
  })

  const rows = useMemo<Doc[]>(() => list.data?.pages.flat() ?? [], [list.data])
  const grouped = sort === 'issueDate'
  const groups = useMemo(
    () => (grouped ? groupByMonth(rows) : [{ key: 'all', rows, sum: '0.00' }]),
    [grouped, rows],
  )

  return {
    stats: stats.data,
    isPending: list.isPending,
    isLoaded: list.isSuccess,
    rows,
    groups,
    grouped,
    hasNextPage: list.hasNextPage,
    isFetchingNextPage: list.isFetchingNextPage,
    fetchNextPage: () => list.fetchNextPage(),
  }
}
