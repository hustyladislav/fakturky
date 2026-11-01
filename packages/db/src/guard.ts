/**
 * Every script that deletes or overwrites data (reset, seed, truncate, restore…) must call this first.
 * Previews and local shells can point at the production database, so an explicit opt-in is required.
 */
export function assertDestructiveAllowed(
  action: string,
  env: Record<string, string | undefined> = process.env,
): void {
  if (env.ALLOW_DESTRUCTIVE_DB === '1') return
  const target = env.DATABASE_URL_UNPOOLED ?? env.DATABASE_URL
  throw new Error(
    [
      `Refusing to ${action}.`,
      target ? 'DATABASE_URL points at a real database (possibly production).' : '',
      'Set ALLOW_DESTRUCTIVE_DB=1 explicitly if you really mean it.',
    ]
      .filter(Boolean)
      .join(' '),
  )
}
