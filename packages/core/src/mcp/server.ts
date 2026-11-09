import { createMcpHandler, fromJsonSchema, McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'
import { buildAgentTools } from '../agent-tools'
import { BRAND } from '../brand'
import type { BaseContext } from '../context'
import { MCP_INSTRUCTIONS } from '../onboarding/runbook'

const GUIDE = `# ${BRAND.name} – příručka pro AI agenty

Fakturační aplikace pro české živnostníky a firmy. Všechny nástroje pracují s firmou přihlášeného uživatele.

Postup vystavení faktury:
1. get_invoice_defaults – výchozí hodnoty (měna, splatnost, bankovní účet).
2. list_contacts / create_contact – zákazník (ověřte IČO).
3. create_invoice_draft – koncept faktury, poté případně update_invoice_draft.
4. issue_invoice – vystavení; teprve tím se přidělí číslo dokladu (číslo nelze znovu použít).
5. mark_document_paid – zaznamenání platby.

Peníze jsou vždy textové desetinné řetězce (např. "1210.50"), nikdy čísla s plovoucí desetinnou čárkou.
Vystavené doklady jsou neměnné; opravy se dělají storno dokladem nebo duplikací do nového konceptu.
`

/** Per-request MCP server exposing every `meta.mcp` procedure for the given caller context. */
export function createMcpFetchHandler(context: BaseContext) {
  return createMcpHandler(() => {
    const server = new McpServer(
      { name: BRAND.slug, version: '1.0.0' },
      { instructions: MCP_INSTRUCTIONS },
    )

    for (const tool of buildAgentTools()) {
      server.registerTool(
        tool.name,
        {
          title: tool.title,
          description: tool.description,
          inputSchema: fromJsonSchema(tool.inputSchema as never),
          outputSchema: tool.outputSchema ? fromJsonSchema(tool.outputSchema as never) : undefined,
          annotations: tool.annotations,
        },
        async (input: unknown) => {
          const result = await tool.execute(input, context)
          return {
            content: [{ type: 'text' as const, text: result.text }],
            structuredContent: result.isError ? undefined : result.structuredContent,
            isError: result.isError,
          }
        },
      )
    }

    server.registerPrompt(
      'nastav_fakturky',
      {
        title: `Nastav ${BRAND.name}`,
        description: 'Projde nastavení účtu a vše, co jde, udělá za vás.',
      },
      () => ({
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `Nastav mi ${BRAND.name}. Řiď se nástrojem get_onboarding_status, udělej všechno, co jde, a ptej se jen na to, co musím rozhodnout já.`,
            },
          },
        ],
      }),
    )

    server.registerPrompt(
      'vystav_fakturu',
      {
        title: 'Vystav fakturu',
        description: 'Vystaví fakturu pro zákazníka podle zadání.',
        argsSchema: z.object({
          zakaznik: z.string().describe('Název nebo IČO zákazníka'),
          zadani: z.string().describe('Co fakturovat: položky, množství, ceny, případně splatnost'),
        }),
      },
      ({ zakaznik, zadani }) => ({
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `Vystav fakturu pro zákazníka „${zakaznik}“.\nZadání: ${zadani}\n\nNejdřív najdi nebo vytvoř kontakt, vytvoř koncept faktury a před vystavením (issue_invoice) mi shrň položky a celkovou částku a vyžádej si potvrzení.`,
            },
          },
        ],
      }),
    )

    server.registerPrompt(
      'neuhrazene_faktury',
      {
        title: 'Neuhrazené faktury',
        description: 'Přehled faktur po splatnosti a doporučené další kroky.',
      },
      () => ({
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: 'Vypiš neuhrazené faktury po splatnosti (list_documents), seřaď je od nejstarších, uveď částky a zákazníky a navrhni, koho připomenout.',
            },
          },
        ],
      }),
    )

    server.registerResource(
      'prirucka',
      `${BRAND.slug}://prirucka`,
      {
        title: `Příručka ${BRAND.name}`,
        description: 'Jak pracovat s nástroji fakturační aplikace.',
        mimeType: 'text/markdown',
      },
      async (uri) => ({ contents: [{ uri: uri.href, text: GUIDE }] }),
    )

    return server
  })
}
