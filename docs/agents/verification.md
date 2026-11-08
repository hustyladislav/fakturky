# Verification: proof before "done"

Done = every claim carries **irrefutable** proof, scaled to the change, and the gaps are named.

## How much

While iterating: LSP diagnostics, `pnpm typecheck`, `pnpm test <file>`. Before "done":

| Change | Proof |
| --- | --- |
| copy, CSS, docs | the affected test |
| logic | `pnpm check` |
| UI | + before/after screenshots of the same screen at 1440 and 390 px, light and dark; video for motion or flows |
| money, numbering, auth, tenancy, CI, scripts | + `pnpm e2e` |

In doubt, less proof and ask.

## What counts

Irrefutable: a skeptic who never ran it sees the claim itself, not your word for it. Strongest first:

1. **The real thing, observed**: the real app on screen, the raw output quoted. Local PGlite and seeded data only: proof never touches production data or a real customer.
2. **Red, then green**: the same check failing on the base and passing on the branch; a new test or guard that goes red when you break the rule.
3. **Handles a reviewer can open**: a CI run id, a command and its exact output.
4. **Reasoning**: only when nothing can be run; say so.

When the change decides something (a verdict, a guard, a branch), cover both outcomes: a case that must come out yes *and* one that must come out no. A flaky test is a finding: compare repeat runs on `main` and the branch before calling it noise.

## Not verified

Every "done" names what was **not** verified, one gap per line; a claim without proof goes there. Emulated phones miss real touch, safe areas and the keyboard.

## Where proof lives

In the PR body under Evidence (the `pr` skill), never in the repo: [pr-evidence.md](pr-evidence.md).
