import { ALWAYS_APPROVE_TOOLS } from '@fakturky/core/agent'
import { buildAgentTools } from '@fakturky/core/agent-tools'
import type { AuthedContext } from '@fakturky/core/context'
import { type AnyServerTool, type JSONSchema, toolDefinition } from '@tanstack/ai'

/** Procedures that are pointless or too heavy for the model (large XML payloads). */
const EXCLUDED = new Set([
  'export_document_isdoc',
  'export_document_pdf',
  'export_contacts_csv',
  'export_documents_csv',
])

/** Cap one tool result so a big list cannot blow up the context (and the bill). */
const MAX_RESULT_CHARS = 24_000

export function needsApproval(tool: { name: string; annotations: { destructiveHint: boolean } }) {
  return tool.annotations.destructiveHint || ALWAYS_APPROVE_TOOLS.has(tool.name)
}

/** Name, description and input schema of every tool that needs approval (for the client's interrupt binding). */
export function listApprovalTools() {
  return buildAgentTools()
    .filter((tool) => !EXCLUDED.has(tool.name) && needsApproval(tool))
    .map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema as Record<string, unknown>,
    }))
}

/**
 * Server tools for one request: every oRPC procedure with `meta.mcp`, executed with the signed-in user's
 * context (`via: 'assistant'`), so tenant isolation and validation are exactly those of the API.
 * Destructive / financially significant tools require the user's approval before they run.
 */
export function buildServerTools(context: {
  db: AuthedContext['db']
  principal: AuthedContext['principal']
  services?: AuthedContext['services']
}): AnyServerTool[] {
  return buildAgentTools()
    .filter((tool) => !EXCLUDED.has(tool.name))
    .map((tool) => {
      const approval = needsApproval(tool)
      const definition = toolDefinition({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema as JSONSchema,
        ...(approval ? { needsApproval: true as const } : {}),
        metadata: { title: tool.title, readOnly: tool.annotations.readOnlyHint },
      })
      return definition.server(async (args: unknown) => {
        const result = await tool.execute(args, context)
        if (result.isError) return { ok: false, error: result.text }
        const text = result.text
        if (text.length > MAX_RESULT_CHARS) {
          return {
            ok: true,
            truncated: true,
            result: `${text.slice(0, MAX_RESULT_CHARS)}\n… (zkráceno, upřesněte filtr nebo limit)`,
          }
        }
        return { ok: true, result: result.structuredContent ?? JSON.parse(text) }
      })
    }) as AnyServerTool[]
}
