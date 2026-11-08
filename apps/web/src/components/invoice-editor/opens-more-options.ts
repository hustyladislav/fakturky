/**
 * The "Další možnosti" block opens by itself only for a stored draft that already uses it. A new invoice
 * gets a default footer and language from the profile while seeding, which must not count.
 */
export function opensMoreOptions(
  isEdit: boolean,
  d: {
    introText: string
    footerText: string
    privateNote: string
    orderNumber: string
    language: string
  },
): boolean {
  if (!isEdit) return false
  return !!(d.introText || d.footerText || d.privateNote || d.orderNumber || d.language !== 'cs')
}
