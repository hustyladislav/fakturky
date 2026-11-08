# Known traps

One line each, with its source. Add what cost you time; remove what stops being true.

- A port can belong to another worktree's server, and health checks then pass against the wrong code. Confirm a free port first; `--strictPort` makes vite fail instead of drifting (`pnpm shots` and `db:seed` trust the URL you give them). Session note, 2026-11-08.
- `pnpm test` regenerates `packages/pdf/examples/*.pdf` byte-differently. Restore them before committing unless the PDF changed. Session note, 2026-11-08.
- `boundingBox()` returns null for a node React just replaced. A `?? 0` in a test hides that; a row remounting right after paint is a product bug (#183).
- The new-invoice form loses input if a seeding effect replaces a line: keep `key` when applying defaults (#183).
