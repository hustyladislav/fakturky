import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { procedure } from '../orpc'
import { bankAccountsRepo } from '../repositories/bank-accounts'
import {
  bankAccountInputSchema,
  bankAccountPatchSchema,
  bankAccountSchema,
} from '../schemas/bank-account'

const idInput = z.object({ id: z.string().min(1) })
const notFound = () => new ORPCError('NOT_FOUND', { message: 'Bank account not found' })

/** Invalid account numbers / IBANs surface as BAD_REQUEST with a readable message. */
async function guard<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    if (e instanceof Error && /^Invalid (IBAN|Czech)/.test(e.message)) {
      throw new ORPCError('BAD_REQUEST', { message: e.message })
    }
    throw e
  }
}

export const bankAccountsRouter = {
  list: procedure({
    mcp: { name: 'list_bank_accounts', title: 'List bank accounts', readOnly: true },
    openapi: {
      method: 'GET',
      path: '/bank-accounts',
      summary: 'List bank accounts',
      tags: ['Bank accounts'],
    },
  })
    .input(z.object({}))
    .output(z.array(bankAccountSchema))
    .handler(({ context }) => bankAccountsRepo.list(context.db, context.principal.organizationId)),

  create: procedure({
    mcp: { name: 'create_bank_account', title: 'Add a bank account' },
    openapi: {
      method: 'POST',
      path: '/bank-accounts',
      summary:
        'Add a bank account. Pass a Czech account number (e.g. "123-456789/0800") or any IBAN; IBAN and BIC are derived.',
      tags: ['Bank accounts'],
    },
  })
    .input(bankAccountInputSchema)
    .output(bankAccountSchema)
    .handler(({ context, input }) =>
      guard(() => bankAccountsRepo.create(context.db, context.principal.organizationId, input)),
    ),

  update: procedure({
    mcp: { name: 'update_bank_account', title: 'Update a bank account', idempotent: true },
    openapi: {
      method: 'PATCH',
      path: '/bank-accounts/{id}',
      summary: 'Update a bank account',
      tags: ['Bank accounts'],
    },
  })
    .input(idInput.extend({ patch: bankAccountPatchSchema }))
    .output(bankAccountSchema)
    .handler(async ({ context, input }) => {
      const row = await guard(() =>
        bankAccountsRepo.update(
          context.db,
          context.principal.organizationId,
          input.id,
          input.patch,
        ),
      )
      if (!row) throw notFound()
      return row
    }),

  setDefault: procedure({
    mcp: {
      name: 'set_default_bank_account',
      title: 'Make a bank account the default for its currency',
      idempotent: true,
    },
    openapi: {
      method: 'POST',
      path: '/bank-accounts/{id}/default',
      summary: 'Make a bank account the default for its currency',
      tags: ['Bank accounts'],
    },
  })
    .input(idInput)
    .output(bankAccountSchema)
    .handler(async ({ context, input }) => {
      const row = await bankAccountsRepo.setDefault(
        context.db,
        context.principal.organizationId,
        input.id,
      )
      if (!row) throw notFound()
      return row
    }),

  delete: procedure({
    mcp: { name: 'delete_bank_account', title: 'Delete a bank account', destructive: true },
    openapi: {
      method: 'DELETE',
      path: '/bank-accounts/{id}',
      summary: 'Delete a bank account (issued documents keep their snapshot)',
      tags: ['Bank accounts'],
    },
  })
    .input(idInput)
    .output(bankAccountSchema)
    .handler(async ({ context, input }) => {
      const row = await bankAccountsRepo.archive(
        context.db,
        context.principal.organizationId,
        input.id,
      )
      if (!row) throw notFound()
      return row
    }),
}
