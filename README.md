# Fakturky

Free, open-source invoicing for Czech (and soon Slovak) freelancers and small businesses.
Web app, MCP server and CLI — everything you can do in the UI, an agent can do too.

> Status: early development.

☕ Support the project: https://buymeacoffee.com/ladislavhusty

## Development

```bash
pnpm install
pnpm dev     # http://localhost:3000 — uses an embedded PGlite database when DATABASE_URL is unset
pnpm check   # biome + typecheck + tests
```

See [AGENTS.md](AGENTS.md) and [docs/](docs/) for architecture and domain rules.
