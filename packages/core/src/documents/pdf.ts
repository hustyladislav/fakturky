import type { Db } from '@fakturky/db'
import { appearanceRepo } from '../appearance/repo'
import type { IssuedDocument, IssuedLine, OriginalDocument, Services } from '../context'

/** PDF of an issued document, drawn with the look frozen at issue (see `document.appearance`). */
export async function renderIssuedPdf(
  db: Db,
  render: NonNullable<Services['renderPdf']>,
  found: { doc: IssuedDocument; lines: IssuedLine[]; original?: OriginalDocument | null },
): Promise<Uint8Array> {
  const look = await appearanceRepo.forDocument(db, found.doc.organizationId, found.doc.appearance)
  return render(found.doc, found.lines, found.original, look)
}
