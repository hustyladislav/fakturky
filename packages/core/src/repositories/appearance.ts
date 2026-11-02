import type { Db } from '@fakturky/db'
import { schema } from '@fakturky/db'
import { and, eq, isNull } from 'drizzle-orm'
import { DocumentError } from './documents'

const { orgAsset, businessProfile } = schema

export const ASSET_KINDS = ['logo', 'signature'] as const
export type AssetKind = (typeof ASSET_KINDS)[number]
const MAX_BYTES = 300 * 1024
const MAX_SIDE = 10_000

const PNG_END = [0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]

/** Structural check of the whole file (signature, header with sane dimensions, end marker). */
function inspect(b: Uint8Array): 'image/png' | 'image/jpeg' | null | 'corrupt' {
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength)
    const ihdr =
      b.length > 33 &&
      String.fromCharCode(b[12] ?? 0, b[13] ?? 0, b[14] ?? 0, b[15] ?? 0) === 'IHDR'
    const w = ihdr ? dv.getUint32(16) : 0
    const h = ihdr ? dv.getUint32(20) : 0
    const ended = PNG_END.every((v, i) => b[b.length - 12 + i] === v)
    return ihdr && ended && w > 0 && h > 0 && w <= MAX_SIDE && h <= MAX_SIDE
      ? 'image/png'
      : 'corrupt'
  }
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    let end = b.length
    while (end > 0 && b[end - 1] === 0) end--
    const eoi = b[end - 2] === 0xff && b[end - 1] === 0xd9
    // Walk the marker segments until a start-of-frame header gives the dimensions.
    let i = 2
    let dims: [number, number] | null = null
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) break
      const marker = b[i + 1] as number
      if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
        i += 2
        continue
      }
      const len = ((b[i + 2] as number) << 8) | (b[i + 3] as number)
      if ([0xc0, 0xc1, 0xc2].includes(marker)) {
        dims = [
          ((b[i + 7] as number) << 8) | (b[i + 8] as number),
          ((b[i + 5] as number) << 8) | (b[i + 6] as number),
        ]
        break
      }
      if (marker === 0xda) break
      i += 2 + len
    }
    return eoi && dims && dims[0] > 0 && dims[1] > 0 && dims[0] <= MAX_SIDE && dims[1] <= MAX_SIDE
      ? 'image/jpeg'
      : 'corrupt'
  }
  return null
}

const current = (orgId: string, kind?: AssetKind) =>
  and(
    eq(orgAsset.organizationId, orgId),
    isNull(orgAsset.supersededAt),
    kind ? eq(orgAsset.kind, kind) : undefined,
  )

export const appearanceRepo = {
  async get(db: Db, orgId: string) {
    const [profile] = await db
      .select({ accentColor: businessProfile.accentColor, showBrand: businessProfile.showBrand })
      .from(businessProfile)
      .where(eq(businessProfile.organizationId, orgId))
    const assets = await db.select().from(orgAsset).where(current(orgId))
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
      throw new DocumentError('BAD_REQUEST', 'The image must be at most 300 KB', ['image.size'])
    }
    const type = inspect(new Uint8Array(bytes))
    if (type === null) {
      throw new DocumentError('BAD_REQUEST', 'Only PNG and JPEG images are supported', [
        'image.type',
      ])
    }
    if (type === 'corrupt') {
      throw new DocumentError('BAD_REQUEST', 'The image file is damaged or incomplete', [
        'image.corrupt',
      ])
    }
    await db.transaction(async (tx) => {
      // Keep the previous version: documents issued with it still render with it.
      await tx.update(orgAsset).set({ supersededAt: new Date() }).where(current(orgId, kind))
      await tx
        .insert(orgAsset)
        .values({ organizationId: orgId, kind, contentType: type, data: bytes.toString('base64') })
    })
    return this.get(db, orgId)
  },

  async deleteAsset(db: Db, orgId: string, kind: AssetKind) {
    await db.update(orgAsset).set({ supersededAt: new Date() }).where(current(orgId, kind))
    return this.get(db, orgId)
  },

  /**
   * The look a document is rendered with: its frozen issue-time snapshot, or (documents issued before
   * snapshots existed, drafts) the organization's current settings.
   */
  async forDocument(
    db: Db,
    orgId: string,
    snapshot: {
      accentColor: string | null
      showBrand: boolean
      logoAssetId: string | null
      signatureAssetId: string | null
    } | null,
  ) {
    const bytes = async (kind: AssetKind, id: string | null | undefined) => {
      const [a] = await db
        .select()
        .from(orgAsset)
        .where(
          snapshot
            ? and(eq(orgAsset.organizationId, orgId), eq(orgAsset.id, id ?? ''))
            : current(orgId, kind),
        )
      return a
        ? {
            bytes: new Uint8Array(Buffer.from(a.data, 'base64')),
            dataUrl: `data:${a.contentType};base64,${a.data}`,
          }
        : null
    }
    const live = snapshot ? null : await this.get(db, orgId)
    return {
      accentColor: snapshot ? snapshot.accentColor : (live?.accentColor ?? null),
      showBrand: snapshot ? snapshot.showBrand : (live?.showBrand ?? true),
      logo: snapshot && !snapshot.logoAssetId ? null : await bytes('logo', snapshot?.logoAssetId),
      signature:
        snapshot && !snapshot.signatureAssetId
          ? null
          : await bytes('signature', snapshot?.signatureAssetId),
    }
  },
}
