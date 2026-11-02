# Which decisions get an entry

An entry earns its place when someone working **away** from the code that
implements it would otherwise get something wrong, or when undoing it is
expensive (data model, vendor, money or legal exposure, how every contributor
works). If the why fits in one line at the one place that implements it, it is
a comment. If only the people who made the change care, git history is enough.

## Typically kept

| Kind of entry | Why it is an entry |
|---|---|
| "Postgres on <provider> as the database" | Backend vendor: every query and migration depends on it. |
| "All background work runs on <queue/workflow engine>" | Where work runs: every new job follows it. |
| "CI runs on PRs and main only; e2e is required" | Changes how every contributor proves a change. |
| "Production deploys only from main" | Infrastructure rule every contributor and agent must obey. |
| "Charges happen before provider calls; refunds only on definite failure" | Money rule every surface must obey. |
| "<Linter/formatter> replaces <previous one>" | Core toolchain. |

## Typically removed, and where the why goes

| Was | Why it is not an entry | Where the why lives |
|---|---|---|
| A retry count or warm-up ramp | Tuning number, one call site. | A constant + one-line comment |
| One page's layout or default | UI / feature default. | Git history |
| An agent skill or editor setting | Agent tooling. | The skill or settings file itself |

## Borderline calls

- **A number** is a tuning number unless it bounds money or legal exposure for every customer.
- **A vendor** is a backend vendor when replacing it reaches across the system.
- **CI or test setup** is infrastructure when it changes how everyone proves a change.
