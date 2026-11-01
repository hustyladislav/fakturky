# Fakturky

Free, open-source invoicing for Czech (and soon Slovak) freelancers and small businesses.
Web app, MCP server and CLI — everything you can do in the UI, an agent can do too.

> Status: early development.

☕ Support the project: https://buymeacoffee.com/ladislavhusty

## For agents: REST, MCP, CLI

Every capability is one oRPC procedure; REST, MCP and the CLI are generated from the same router.

- **REST API** — `https://fakturky.vercel.app/api/v1` with `Authorization: Bearer fk_…`
  (create a key in _Nastavení → API klíče_). Reference: `/docs/api`, spec: `/api/v1/openapi.json`.
- **Remote MCP server** — `https://fakturky.vercel.app/mcp` (Streamable HTTP, stateless).
  OAuth 2.1 with Client ID Metadata Documents (discovery at `/.well-known/oauth-protected-resource`)
  or an API key as bearer token. Details and per-client setup: `/docs/mcp`.

  ```bash
  claude mcp add --transport http fakturky https://fakturky.vercel.app/mcp
  npx @modelcontextprotocol/inspector --cli https://fakturky.vercel.app/mcp --transport http \
    --header "Authorization: Bearer fk_…" --method tools/list
  ```

  Cursor / generic `mcp.json`:

  ```json
  { "mcpServers": { "fakturky": { "url": "https://fakturky.vercel.app/mcp",
    "headers": { "Authorization": "Bearer fk_…" } } } }
  ```

## Development

```bash
pnpm install
pnpm dev     # http://localhost:3000 — uses an embedded PGlite database when DATABASE_URL is unset
pnpm check   # biome + typecheck + tests
```

See [AGENTS.md](AGENTS.md) and [docs/](docs/) for architecture and domain rules.
