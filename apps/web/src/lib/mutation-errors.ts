import { MutationCache } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiErrorMessage } from '@/lib/errors'

/** A failed mutation always tells the user, in Czech; one with its own `onError` reports it itself. */
export function createMutationCache() {
  return new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (!mutation.options.onError) toast.error(apiErrorMessage(error))
    },
  })
}
