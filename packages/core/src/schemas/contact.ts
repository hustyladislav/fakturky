import { z } from 'zod'

export const addressSchema = z.object({
  street: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  zip: z.string().max(20).optional(),
  country: z.string().max(2).optional(),
})

const language = z.enum(['cs', 'sk', 'en'])

export const contactInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  ico: z.string().trim().max(20).nullish(),
  dic: z.string().trim().max(20).nullish(),
  icDph: z.string().trim().max(20).nullish(),
  address: addressSchema.default({}),
  country: z.string().length(2).default('CZ'),
  emails: z.array(z.email()).max(10).default([]),
  phone: z.string().trim().max(50).nullish(),
  defaultDueDays: z.number().int().min(0).max(365).nullish(),
  defaultCurrency: z.string().length(3).nullish(),
  defaultLanguage: language.nullish(),
  note: z.string().max(5000).nullish(),
})

export const contactSchema = contactInputSchema.extend({
  id: z.string(),
  organizationId: z.string(),
  aresSyncedAt: z.date().nullable(),
  archivedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export type ContactInput = z.infer<typeof contactInputSchema>
export type Contact = z.infer<typeof contactSchema>
