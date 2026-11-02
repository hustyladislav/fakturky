import type { Db } from '@fakturky/db'
import { schema } from '@fakturky/db'
import { and, eq } from 'drizzle-orm'
import { DocumentError } from './documents'

const { orgAsset, businessProfile } = schema

export const ASSET_KINDS = ['logo', 'signature'] as const
export type AssetKind = (typeof ASSET_KINDS)[number]
const MAX_BYTES = 300 * 1024

/** PNG and JPEG only (what the PDF renderer embeds); the type is verified from the bytes, not the claim. */
function sniff(bytes: Uint8Array): 'image/png' | 'image/jpeg' | null {
  if (
    bytes.length > 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'image/png'
  }
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return 'image/jpeg'
  return null
}

export const appearanceRepo = {
  async get(db: Db, orgId: string) {
    const [profile] = await db
      .select({ accentColor: businessProfile.accentColor, showBrand: businessProfile.showBrand })
      .from(businessProfile)
      .where(eq(businessProfile.organizationId, orgId))
    const assets = await db.select().from(orgAsset).where(eq(orgAsset.organizationId, orgId))
    const url = (k: AssetKind) => {
      const a = assets.find((x) => x.kind === k)
      return a ? `data:${a.contentType};base64,${a.data}` : null
    }
    return {
      accentColor: profile?.accentColor ?? null,
      showBrand: profile?.showBrand ?? true,
      logo: url('logo'),
      signature: url('signature'),
    }
  },

  async update(db: Db, orgId: string, patch: { accentColor?: string | null; showBrand?: boolean }) {
    const [row] = await db
      .update(businessProfile)
      .set(patch)
      .where(eq(businessProfile.organizationId, orgId))
      .returning({ id: businessProfile.id })
    if (!row) throw new DocumentError('PRECONDITION_FAILED', 'Fill in your business profile first')
    return this.get(db, orgId)
  },

  async setAsset(db: Db, orgId: string, kind: AssetKind, base64: string) {
    const bytes = Buffer.from(base64, 'base64')
    if (bytes.length === 0 || bytes.length > MAX_BYTES) {
      throw new DocumentError('BAD_REQUEST', 'The image must be at most 300 KB')
    }
    const type = sniff(bytes)
    if (!type) throw new DocumentError('BAD_REQUEST', 'Only PNG and JPEG images are supported')
    await db
      .insert(orgAsset)
      .values({ organizationId: orgId, kind, contentType: type, data: bytes.toString('base64') })
      .onConflictDoUpdate({
        target: [orgAsset.organizationId, orgAsset.kind],
        set: { contentType: type, data: bytes.toString('base64') },
      })
    return this.get(db, orgId)
  },

  async deleteAsset(db: Db, orgId: string, kind: AssetKind) {
    await db
      .delete(orgAsset)
      .where(and(eq(orgAsset.organizationId, orgId), eq(orgAsset.kind, kind)))
    return this.get(db, orgId)
  },

  /** Raw bytes for document rendering. */
  async bytes(db: Db, orgId: string, kind: AssetKind) {
    const [a] = await db
      .select()
      .from(orgAsset)
      .where(and(eq(orgAsset.organizationId, orgId), eq(orgAsset.kind, kind)))
    return a ? new Uint8Array(Buffer.from(a.data, 'base64')) : null
  },
}
