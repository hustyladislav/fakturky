---
name: pr
description: Use whenever you create or change a pull request. Writes the body for `gh pr create`, and rewrites it with `gh pr edit` after every push to a branch that has an open PR, so the description always matches the code.
---

# Pull request bodies

A reviewer should know in under a minute what changed, whether it works, and how
carefully to read it. Pictures over paragraphs; no preamble.

## When

- **Creating a PR:** write the body with the template below.
- **After every push to a branch with an open PR:** read the current body
  (`gh pr view <n> --json title,body`) and rewrite it so it describes the PR
  **as it stands now** — Summary, Evidence, Merge Danger and Not verified all
  reflect the latest commit. Not a changelog of pushes: history lives in the
  commits. Update the title too if the scope changed.

Pass the body as a file — write it to the scratchpad, then
`gh pr create --title "…" --body-file <file>` or
`gh pr edit <n> --body-file <file>`. A hook rejects a body that is missing the
template's sections.

## Template

```markdown
**<One sentence: what this PR changes and why.>**

## Summary

<the smallest picture that makes the point, each next to a line or two of text>

## Evidence

- **Before:** <failing test, error, screenshot, timing>
  **After:** <passing test, output, screenshot, timing>
- **Not verified:** <what you did not prove, or "nothing beyond the above">

## Merge Danger

**Door:** <one-way | two-way> — <why>

**Blast radius:** <one word> — <what could break, and for whom>

## Rejected

- **<alternative>:** <why not>
```

`## Rejected` is optional: use it when you weighed a real alternative that a
future reader might propose again. Keep the attribution footer the session asks
for.

## Summary

Pick the smallest view that makes the key point. Usually one, sometimes two,
never all of them. Keep only the calls, files and states the point needs.

- **Logic** as pseudocode:

  ```text
  on(invoice issued)
    allocate number in a transaction
    snapshot customer + supplier
    render PDF lazily on first download
  ```

- **Runtime flow** as a call tree, or a `diff` of one when the shape already
  exists:

  ```diff
   handleRequest
     authenticate
  +    rateLimit
     runProcedure
  ```

- **File responsibility or a refactor** as a shallow file tree (or its `diff`):

  ```text
  src/core/billing/
  ├── limits.ts      # plan caps
  ├── charges.ts     # the only place that moves money
  └── provider.ts    # payment provider client
  ```

- **Interaction between systems** (app, queue, database, third parties, webhooks) as a
  Mermaid `sequenceDiagram`.
- **UI** as a component tree, plus before/after screenshots under Evidence.
- **A small new block** as the code itself, when most of it is new.

Docs-only, CI-only or one-line PRs may skip the picture: one or two sentences is
the smallest view.

## Evidence

Show before and after, strongest first:

1. **Screenshot or video** — for any frontend change: a before/after pair of the same
   screen (a video for motion or multi-step flows). No visible effect → say so.
2. **Execution** — the exact test that failed and now passes, command output,
   CI run ids, timings.
3. **Reasoning** — only when nothing can be run; say so.

Match the proof to the change, as in `AGENTS.md`: copy/CSS/docs → the affected
test · logic → `pnpm verify` · UI → + screenshot · risky paths → + `pnpm e2e`. **Not verified** is mandatory: name what you did not check.

## Merge Danger

**Door.** Two-way: reverting the commit fully undoes it. One-way: some effect
outlives a revert. Typical one-way doors (adapt the list in `AGENTS.md` → "Never break"):

- a migration that drops, rewrites or backfills data
- anything that moves money or changes pricing
- e-mails, messages or notifications that reach real people
- auth, permissions, tenancy, or secrets handling
- public API, webhook or event contracts that clients or in-flight jobs depend on

A one-way door needs the strongest proof under Evidence (e2e or a migration dry
run) and an explicit ask for human review.

**Blast radius.** One word, then what could break: `none` (docs, tests),
`tooling` (CI, scripts, agent setup), `ui`, `tenant` (one customer's data), `platform` (every customer), `money`.
