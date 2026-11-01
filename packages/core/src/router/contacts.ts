import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { procedure } from '../orpc'
import { contactsRepo } from '../repositories/contacts'
import { contactInputSchema, contactSchema } from '../schemas/contact'

const idInput = z.object({ id: z.string().min(1) })

const notFound = () => new ORPCError('NOT_FOUND', { message: 'Contact not found' })

export const contactsRouter = {
  list: procedure({
    mcp: { name: 'list_contacts', title: 'List contacts', readOnly: true },
    openapi: { method: 'GET', path: '/contacts', summary: 'List contacts', tags: ['Contacts'] },
  })
    .input(
      z.object({
        search: z.string().optional(),
        includeArchived: z.boolean().default(false),
        limit: z.number().int().min(1).max(200).default(50),
        offset: z.number().int().min(0).default(0),
      }),
    )
    .output(z.array(contactSchema))
    .handler(({ context, input }) =>
      contactsRepo.list(context.db, context.principal.organizationId, input),
    ),

  get: procedure({
    mcp: { name: 'get_contact', title: 'Get a contact', readOnly: true },
    openapi: {
      method: 'GET',
      path: '/contacts/{id}',
      summary: 'Get a contact',
      tags: ['Contacts'],
    },
  })
    .input(idInput)
    .output(contactSchema)
    .handler(async ({ context, input }) => {
      const row = await contactsRepo.get(context.db, context.principal.organizationId, input.id)
      if (!row) throw notFound()
      return row
    }),

  create: procedure({
    mcp: { name: 'create_contact', title: 'Create a contact' },
    openapi: { method: 'POST', path: '/contacts', summary: 'Create a contact', tags: ['Contacts'] },
  })
    .input(contactInputSchema)
    .output(contactSchema)
    .handler(({ context, input }) =>
      contactsRepo.create(context.db, context.principal.organizationId, input),
    ),

  update: procedure({
    mcp: { name: 'update_contact', title: 'Update a contact', idempotent: true },
    openapi: {
      method: 'PATCH',
      path: '/contacts/{id}',
      summary: 'Update a contact',
      tags: ['Contacts'],
    },
  })
    .input(idInput.extend({ patch: contactInputSchema.partial() }))
    .output(contactSchema)
    .handler(async ({ context, input }) => {
      const row = await contactsRepo.update(
        context.db,
        context.principal.organizationId,
        input.id,
        input.patch as never,
      )
      if (!row) throw notFound()
      return row
    }),

  archive: procedure({
    mcp: {
      name: 'archive_contact',
      title: 'Archive a contact',
      destructive: true,
      idempotent: true,
    },
    openapi: {
      method: 'POST',
      path: '/contacts/{id}/archive',
      summary: 'Archive a contact',
      tags: ['Contacts'],
    },
  })
    .input(idInput)
    .output(contactSchema)
    .handler(async ({ context, input }) => {
      const row = await contactsRepo.archive(context.db, context.principal.organizationId, input.id)
      if (!row) throw notFound()
      return row
    }),
}
