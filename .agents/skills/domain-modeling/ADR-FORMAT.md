# ADR Format

ADRs live in `docs/adr/`, one file per subject: `NNNN-slug.md`, numbered after the highest number ever used (deleted ones count: check git history). Numbers are never reused, so gaps are expected: commits, PRs and issues cite them. The slug says the decision (`crons-run-only-in-production`), because agents pick ADRs by file name.

## Template

```md
# {The decision, stated as a rule}

{1-3 sentences: what forced a choice, what we do, and why.}

**Rejected:** {alternative}: {why it lost}. {alternative}: {why it lost}.
```

That's it. Most ADRs are one paragraph plus a Rejected line. Optional, only when they add genuine value:

- **Bullets** under the paragraph, when the decision has parts every contributor must obey (one rule per bullet).
- **Rejected**, when someone would otherwise propose the alternative again. Skip obvious losers and alternatives whose reason wasn't recorded.
- **Consequences:** one line, only for a non-obvious cost or trap a future reader would walk into.

Under 150 words. Past that, it's a spec: the detail belongs in the code.

## What stays out

The ADR records *that* we decided and *why*. Everything that changes with the code stays out:

- Function, file and env-var names, unless naming the one module that enforces the rule is the only way a reader finds it.
- Tuning numbers. A number stays only when it bounds money or legal exposure for every Company (an ad cap, a margin).
- Commit SHAs, dates, who decided, the history of how we got here. Git has them.
- Benchmarks and evaluation tables. Link the PR that holds them.

Use `GLOSSARY.md` terms. Cite invariants as `§11.x` / `§12.x`.

## Changing a decision

An ADR is living. When the decision changes, rewrite the ADR for the same subject in place, and move the old choice into **Rejected** with the reason it lost. No status field, no superseded stubs, no chains. A new number is only for a new subject.

When two subjects merge, the merged ADR keeps one of their numbers and the other retires. When a subject stops mattering, delete the ADR and every `docs/adr/NNNN` reference to it in the same PR.

Code that embodies a decision points at it (`// see docs/adr/0062`) instead of explaining the history inline.

## When to offer an ADR

All three of these must be true:

1. **Hard to reverse**: the cost of changing your mind later is meaningful
2. **Surprising without context**: a future reader will look at the code and wonder "why on earth did they do it this way?"
3. **The result of a real trade-off**: there were genuine alternatives and you picked one for specific reasons

If a decision is easy to reverse, skip it: you'll just reverse it. If it's not surprising, nobody will wonder why. If there was no real alternative, there's nothing to record beyond "we did the obvious thing." A feature default, a tuning number, UI layout or copy, prompt craft, one Employee's configuration, or agent tooling is never an ADR: put the why in a one-line comment at the code, or in the commit message.

Before writing a new ADR, check whether an existing one owns the subject. Extend that one instead.

### What qualifies

- **Architectural shape.** "Durable work runs on Inngest." "The Brain keeps its own versioned store."
- **Technology choices that carry lock-in.** Database, model transport, auth provider, deployment target. Not every library: just the ones that would take a quarter to swap out.
- **Platform-wide rules on money, security or legal exposure.** "Ads are created paused." "One cold opener per address." Every surface, present or future, must obey them.
- **Boundary and scope decisions.** The explicit no-s are as valuable as the yes-s.
- **Deliberate deviations from the obvious path.** Anything where a reasonable reader would assume the opposite. These stop the next engineer from "fixing" something that was deliberate.
- **Constraints not visible in the code.** "Prompts may not leave the EU."
- **Rejected alternatives when the rejection is non-obvious.** Otherwise someone will suggest them again in six months.
