import type { Db } from '@fakturky/db'
import { schema } from '@fakturky/db'
import { eq } from 'drizzle-orm'
import type { BusinessProfilePatch } from '../schemas/business-profile'

const { businessProfile } = schema

/** One profile per organization; every function is scoped by `orgId`. */
export const businessProfileRepo = {
  async get(db: Db, orgId: string) {
    const [row] = await db
      .select()
      .from(businessProfile)
      .where(eq(businessProfile.organizationId, orgId))
    return row ?? null
  },

  /** Creates the profile on first use so every organization always has exactly one. */
  async getOrCreate(db: Db, orgId: string, legalName: string) {
    await db
      .insert(businessProfile)
      .values({ organizationId: orgId, legalName })
      .onConflictDoNothing({ target: businessProfile.organizationId })
    const row = await this.get(db, orgId)
    if (!row) throw new Error('business profile missing')
    return row
  },

  async update(db: Db, orgId: string, patch: BusinessProfilePatch, markOnboarded: boolean) {
    const [row] = await db
      .update(businessProfile)
      .set({ ...patch, ...(markOnboarded ? { onboardedAt: new Date() } : {}) })
      .where(eq(businessProfile.organizationId, orgId))
      .returning()
    return row ?? null
  },
}
