import { z } from 'zod'
import { addressSchema } from './contact'

export const vatStatusSchema = z.enum(['non_payer', 'payer', 'identified_person'])

const fields = {
  legalName: z.string().trim().min(1).max(200),
  ico: z.string().trim().max(20).nullish(),
  dic: z.string().trim().max(20).nullish(),
  address: addressSchema,
  vatStatus: vatStatusSchema,
  registryNote: z.string().trim().max(500).nullish(),
  email: z.email().nullish(),
  phone: z.string().trim().max(50).nullish(),
  website: z.string().trim().max(200).nullish(),
  defaultCurrency: z.string().length(3),
  defaultDueDays: z.number().int().min(0).max(365),
  defaultLanguage: z.enum(['cs', 'sk', 'en']),
  defaultFooter: z.string().max(2000).nullish(),
  defaultNote: z.string().max(2000).nullish(),
}

/** Only the keys present are updated. */
export const businessProfilePatchSchema = z.object(fields).partial()

export const businessProfileSchema = z.object({
  ...fields,
  id: z.string(),
  organizationId: z.string(),
  onboardedAt: z.date().nullable(),
})

export const aresSubjectSchema = z.object({
  ico: z.string(),
  name: z.string(),
  dic: z.string().nullable(),
  address: z.object({ street: z.string(), city: z.string(), zip: z.string(), country: z.string() }),
  vatPayer: z.boolean(),
})

export type BusinessProfile = z.infer<typeof businessProfileSchema>
export type BusinessProfilePatch = z.infer<typeof businessProfilePatchSchema>
