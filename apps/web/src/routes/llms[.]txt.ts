import { BRAND } from '@fakturky/core/brand'
import { createFileRoute } from '@tanstack/react-router'

/** llms.txt (https://llmstxt.org): what the product is and how an agent can use it. */
async function render(origin: string): Promise<string> {
  const { listToolDescriptors } = await import('@fakturky/core/agent-tools')
  const tools = listToolDescriptors()
    .map(
      (t) =>
        `- \`${t.name}\`${t.annotations.destructiveHint ? ' (destructive)' : ''}: ${t.description}`,
    )
    .join('\n')

  return `# ${BRAND.name}

> ${BRAND.tagline}. Free and open source. Everything you can do in the web UI, an AI agent can do through the REST API, the remote MCP server or the CLI — all generated from one router.

${BRAND.name} issues Czech invoices and proformas (VAT per rate with 2-decimal rounding, gap-free document numbers allocated at issue, QR payment codes, ISDOC export). The UI is in Czech. Money amounts are decimal strings (e.g. "1210.50"), never floats. Issued documents are immutable snapshots; correct them by cancelling or duplicating into a new draft.

## Connect an agent

- [MCP server](${origin}/mcp): remote, Streamable HTTP, stateless. OAuth 2.1 (Client ID Metadata Documents; discovery at ${origin}/.well-known/oauth-protected-resource/mcp) or \`Authorization: Bearer fk_…\` with an API key.
- [MCP setup guide](${origin}/docs/mcp): Claude, Claude Code, ChatGPT, Cursor.
- [REST API reference](${origin}/docs/api) and [OpenAPI spec](${origin}/api/v1/openapi.json): base URL \`${origin}/api/v1\`, bearer API key.
- [CLI](${BRAND.repoUrl}/tree/main/packages/cli): \`npx fakturky login\`, then \`fakturky <group> <action>\` (e.g. \`fakturky contacts list --json\`).
- API keys are created by the user in the app: Nastavení → API klíče. A key acts on exactly one organization.

## MCP tools

${tools}

Typical flow for an invoice: \`get_invoice_defaults\` → find or create the customer (\`list_contacts\`, \`create_contact\`) → \`create_invoice_draft\` → \`issue_invoice\` (allocates the number; confirm with the user first) → \`mark_document_paid\`.

## Source

- [Repository](${BRAND.repoUrl})
- [Documentation](${BRAND.docsUrl})
- [Issues](${BRAND.issuesUrl})
`
}

export const Route = createFileRoute('/llms.txt')({
  server: {
    handlers: {
      GET: async ({ request }) =>
        new Response(await render(new URL(request.url).origin), {
          headers: {
            'content-type': 'text/plain; charset=utf-8',
            'cache-control': 'public, max-age=3600',
          },
        }),
    },
  },
})
