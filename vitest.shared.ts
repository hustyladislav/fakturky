/** A PGlite-backed file boots and migrates its own database; on a busy machine that outlasts vitest's 5 s / 10 s. */
export const pgliteTimeouts = { hookTimeout: 120_000, testTimeout: 60_000 }
