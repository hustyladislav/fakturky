import { call, ORPCError, traverseContractProcedures } from '@orpc/server'
import { z } from 'zod'
import type { BaseContext } from '../context'
import type { ProcedureMeta } from '../meta'
import { router } from '../router'

type JsonSchema = Record<string, unknown>

export type ToolAnnotations = {
  title: string
  readOnlyHint: boolean
  destructiveHint: boolean
  idempotentHint: boolean
  openWorldHint: false
}

/** Transport-agnostic description of one callable capability (an MCP tool, an in-app assistant tool). */
export type ToolDescriptor = {
  name: string
  title: string
  description: string
  inputSchema: JsonSchema
  /** Always an object schema; non-object procedure outputs are wrapped as `{ result }`. */
  outputSchema: JsonSchema | undefined
  annotations: ToolAnnotations
  /** Router path, e.g. `['contacts', 'list']`. */
  path: string[]
}

export type ToolResult = {
  isError: boolean
  /** Human/LLM readable rendering (JSON). */
  text: string
  structuredContent?: Record<string, unknown>
}

export type AgentTool = ToolDescriptor & {
  execute(input: unknown, context: BaseContext): Promise<ToolResult>
}

type Def = {
  meta?: ProcedureMeta
  inputSchema?: z.ZodType
  outputSchema?: z.ZodType
}

const toJsonSchema = (schema: z.ZodType, io: 'input' | 'output'): JsonSchema => {
  const { $schema: _omit, ...rest } = z.toJSONSchema(schema, {
    io,
    unrepresentable: 'any',
    target: 'draft-2020-12',
  }) as JsonSchema
  return rest
}

const isObjectSchema = (schema: JsonSchema) => schema.type === 'object'

function describe(def: Def, path: string[]): Omit<AgentTool, 'execute'> | null {
  const mcp = def.meta?.mcp
  if (!mcp) return null

  const input = def.inputSchema ? toJsonSchema(def.inputSchema, 'input') : undefined
  if (input && !isObjectSchema(input)) {
    throw new Error(`Tool ${mcp.name}: procedure input must be an object schema`)
  }
  const output = def.outputSchema ? toJsonSchema(def.outputSchema, 'output') : undefined

  return {
    name: mcp.name,
    title: mcp.title,
    description: mcp.description ?? def.meta?.openapi?.summary ?? mcp.title,
    inputSchema: input ?? { type: 'object', properties: {} },
    outputSchema: output
      ? isObjectSchema(output)
        ? output
        : { type: 'object', properties: { result: output }, required: ['result'] }
      : undefined,
    annotations: {
      title: mcp.title,
      readOnlyHint: mcp.readOnly ?? false,
      destructiveHint: mcp.destructive ?? false,
      idempotentHint: mcp.idempotent ?? false,
      openWorldHint: false,
    },
    path,
  }
}

function serialize(value: unknown, wrap: boolean): ToolResult {
  const structured = wrap ? { result: value } : (value as Record<string, unknown>)
  return {
    isError: false,
    text: JSON.stringify(value ?? null, null, 2),
    structuredContent: structured && typeof structured === 'object' ? structured : undefined,
  }
}

function toError(error: unknown): ToolResult {
  if (error instanceof ORPCError) {
    const detail = error.data ? ` ${JSON.stringify(error.data)}` : ''
    return { isError: true, text: `${error.code}: ${error.message}${detail}` }
  }
  // Unknown failures must not leak internals to the model.
  return { isError: true, text: 'INTERNAL_SERVER_ERROR: Unexpected error' }
}

/** Walk the router and build one tool per procedure that declares `meta.mcp`. */
export function buildAgentTools(
  root: Parameters<typeof traverseContractProcedures>[0]['router'] = router,
): AgentTool[] {
  const tools: AgentTool[] = []
  const names = new Set<string>()

  traverseContractProcedures({ path: [], router: root }, ({ contract, path }) => {
    const def = (contract as unknown as { '~orpc': Def })['~orpc']
    const descriptor = describe(def, [...path])
    if (!descriptor) return
    if (names.has(descriptor.name)) throw new Error(`Duplicate tool name: ${descriptor.name}`)
    names.add(descriptor.name)

    const rawOutput = def.outputSchema ? toJsonSchema(def.outputSchema, 'output') : undefined
    const wrap = !!rawOutput && !isObjectSchema(rawOutput)

    tools.push({
      ...descriptor,
      async execute(input, context) {
        try {
          const output = await call(contract as never, input as never, { context })
          return serialize(output, wrap)
        } catch (error) {
          return toError(error)
        }
      },
    })
  })

  return tools
}

/** Descriptors only (no executor) — for docs, CLI generation and tests. */
export function listToolDescriptors(): ToolDescriptor[] {
  return buildAgentTools().map(({ execute: _execute, ...descriptor }) => descriptor)
}
