# Security policy

Fakturky holds invoicing data of small businesses, so we take vulnerability reports seriously.

## Reporting a vulnerability

Please **do not open a public issue**. Report privately through GitHub:

<https://github.com/hustyladislav/fakturky/security/advisories/new>

Include what you found, how to reproduce it, and the impact you expect. You can expect an acknowledgement
within 3 working days and a fix or mitigation plan within 14 days for confirmed high-severity issues.
We credit reporters in the advisory unless they prefer to stay anonymous.

## Scope

In scope: the hosted app (https://fakturky.vercel.app and its production domain), the REST API (`/api/v1`),
the MCP server (`/mcp`), the public invoice pages (`/f/:token`), the CLI, and this repository's code and CI.

Of particular interest: cross-tenant data access, authentication or API-key bypass, access to invoices
without their link token, SSRF through the lookup proxies, and injection (XSS, SQL, header).

Out of scope: denial of service by volume, social engineering, findings that need a compromised device,
missing best-practice headers without demonstrated impact, and third-party services (Vercel, Neon, Resend).

## Supported versions

Only the latest deployment of `main` is supported.
