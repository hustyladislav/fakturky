import { z } from 'zod'

export const addressSchema = z.object({
  street: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  zip: z.string().max(20).optional(),
  country: z.string().max(2).optional(),
})

const language = z.enum(['cs', 'sk', 'en'])

// Field definitions without defaults, shared by create and patch (Zod 4 `.partial()` keeps defaults).
const fields = {
  name: z.string().trim().min(1).max(200),
  ico: z.string().trim().max(20).nullish(),
  dic: z.string().trim().max(20).nullish(),
  icDph: z.string().trim().max(20).nullish(),
  address: addressSchema,
  country: z.string().length(2),
  emails: z.array(z.email()).max(10),
  phone: z.string().trim().max(50).nullish(),
  defaultDueDays: z.number().int().min(0).max(365).nullish(),
  defaultCurrency: z.string().length(3).nullish(),
  defaultLanguage: language.nullish(),
  note: z.string().max(5000).nullish(),
}

export const contactInputSchema = z.object({
  ...fields,
  address: fields.address.default({}),
  country: fields.country.default('CZ'),
  emails: fields.emails.default([]),
})

/** Only the keys present are updated. */
export const contactPatchSchema = z.object(fields).partial()

export const contactSchema = contactInputSchema.extend({
  id: z.string(),
  organizationId: z.string(),
  aresSyncedAt: z.date().nullable(),
  archivedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export type ContactPatch = z.infer<typeof contactPatchSchema>
export type ContactInput = z.infer<typeof contactInputSchema>
export type Contact = z.infer<typeof contactSchema>
