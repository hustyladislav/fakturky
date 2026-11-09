import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { procedure } from '../orpc'
import { ASSET_KINDS, appearanceRepo } from './repo'
import { DocumentError } from '../documents/repo'

const tag = ['Appearance']
const appearanceSchema = z.object({
  accentColor: z.string().nullable(),
  showBrand: z.boolean(),
  logo: z.string().nullable().describe('data: URL, private to the organization'),
  signature: z.string().nullable().describe('data: URL, private to the organization'),
})

async function guard<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    if (e instanceof DocumentError) {
      throw new ORPCError(e.code, {
        message: e.message,
        ...(e.fields ? { data: { fields: e.fields } } : {}),
      })
    }
    throw e
  }
}

export const appearanceRouter = {
  get: procedure({
    mcp: {
      name: 'get_document_appearance',
      title: 'Document appearance: accent color, logo, signature',
      readOnly: true,
    },
    openapi: {
      method: 'GET',
      path: '/appearance',
      summary: 'Document appearance settings',
      tags: tag,
    },
  })
    .input(z.object({}))
    .output(appearanceSchema)
    .handler(({ context }) => appearanceRepo.get(context.db, context.principal.organizationId)),

  update: procedure({
    mcp: {
      name: 'update_document_appearance',
      title: 'Set the accent color and the "issued with" line',
      idempotent: true,
    },
    openapi: {
      method: 'PATCH',
      path: '/appearance',
      summary: 'Update accent color / brand line',
      tags: tag,
    },
  })
    .input(
      z.object({
        accentColor: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/, 'Expected #RRGGBB')
          .nullable()
          .optional(),
        showBrand: z.boolean().optional(),
      }),
    )
    .output(appearanceSchema)
    .handler(({ context, input }) =>
      guard(() => appearanceRepo.update(context.db, context.principal.organizationId, input)),
    ),

  setAsset: procedure({
    mcp: {
      name: 'upload_logo_or_signature',
      title: 'Upload the logo or signature image (PNG/JPEG, max 300 KB)',
    },
    openapi: {
      method: 'PUT',
      path: '/appearance/{kind}',
      summary: 'Upload a logo or signature (base64 PNG/JPEG, max 300 KB)',
      tags: tag,
    },
  })
    .input(z.object({ kind: z.enum(ASSET_KINDS), dataBase64: z.string().min(8).max(500_000) }))
    .output(appearanceSchema)
    .handler(({ context, input }) =>
      guard(() =>
        appearanceRepo.setAsset(
          context.db,
          context.principal.organizationId,
          input.kind,
          input.dataBase64,
        ),
      ),
    ),

  deleteAsset: procedure({
    mcp: {
      name: 'delete_logo_or_signature',
      title: 'Remove the logo or signature',
      destructive: true,
      idempotent: true,
    },
    openapi: {
      method: 'DELETE',
      path: '/appearance/{kind}',
      summary: 'Remove a logo or signature',
      tags: tag,
    },
  })
    .input(z.object({ kind: z.enum(ASSET_KINDS) }))
    .output(appearanceSchema)
    .handler(({ context, input }) =>
      guard(() =>
        appearanceRepo.deleteAsset(context.db, context.principal.organizationId, input.kind),
      ),
    ),
}
