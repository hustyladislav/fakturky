export const TYPES = ['invoice', 'proforma', 'credit_note', 'payment_receipt'] as const
export const FILTERS = ['all', 'draft', 'unpaid', 'overdue', 'paid'] as const
export const SORTS = ['issueDate', 'dueDate', 'number', 'customer', 'total'] as const

export type DocType = (typeof TYPES)[number]
export type Filter = (typeof FILTERS)[number]
export type Sort = (typeof SORTS)[number]
export type Dir = 'asc' | 'desc'

export interface ListSearch {
  filter?: Filter
  q?: string
  type?: DocType
  sort?: Sort
  dir?: Dir
}

/** Plain validation (no zod): keeps the schema library out of the client bundle. */
export function validateListSearch(search: Record<string, unknown>): ListSearch {
  return {
    filter: FILTERS.find((f) => f === search.filter),
    type: TYPES.find((x) => x === search.type),
    q: typeof search.q === 'string' && search.q ? search.q : undefined,
    sort: SORTS.find((x) => x === search.sort),
    dir: search.dir === 'asc' || search.dir === 'desc' ? search.dir : undefined,
  }
}

/** Next sort state after a header click: the same column flips, a new one starts at its natural order. */
export function nextSort(
  current: { sort: Sort; dir: Dir },
  column: Sort,
): { sort?: Sort; dir: Dir } {
  const same = current.sort === column
  return {
    // Newest-first by issue date is the default and stays out of the URL.
    sort: column === 'issueDate' && current.dir === 'desc' && !same ? undefined : column,
    dir: same
      ? current.dir === 'desc'
        ? 'asc'
        : 'desc'
      : column === 'customer' || column === 'number'
        ? 'asc'
        : 'desc',
  }
}
