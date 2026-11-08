import { Input } from '@fakturky/ui/components/input'
import { cn } from '@fakturky/ui/lib/utils'
import { Search } from 'lucide-react'
import type { ComponentProps } from 'react'
import { cs } from '@/i18n/cs'

/** The list search box: quiet fill, same everywhere. `className` sizes the wrapper. */
export function SearchField({ className, ...input }: ComponentProps<typeof Input>) {
  return (
    <div className={cn('relative min-w-0', className)}>
      <Search
        className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        className="border-transparent bg-muted/60 pl-8 dark:bg-muted/60"
        aria-label={cs.common.search}
        enterKeyHint="search"
        {...input}
      />
    </div>
  )
}
