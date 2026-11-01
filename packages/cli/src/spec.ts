export type ParamSchema = {
  type?: string | string[]
  anyOf?: ParamSchema[]
  description?: string
  enum?: unknown[]
}

export type Param = { name: string; description?: string; required: boolean; kind: ArgKind }
export type ArgKind = 'string' | 'number' | 'boolean' | 'json'

export type Operation = {
  group: string
  action: string
  method: string
  path: string
  summary: string
  pathParams: Param[]
  queryParams: Param[]
  bodyProps: Param[]
}

type OpenApiSpec = {
  paths?: Record<string, Record<string, OpenApiOperation>>
}

type OpenApiOperation = {
  operationId?: string
  summary?: string
  parameters?: {
    name: string
    in: string
    required?: boolean
    description?: string
    schema?: ParamSchema
  }[]
  requestBody?: {
    content?: Record<
      string,
      { schema?: { properties?: Record<string, ParamSchema>; required?: string[] } }
    >
  }
}

const types = (schema: ParamSchema | undefined): string[] => {
  if (!schema) return []
  const own = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : []
  return [...own, ...(schema.anyOf ?? []).flatMap(types)]
}

export function kindOf(schema: ParamSchema | undefined): ArgKind {
  const t = types(schema).filter((x) => x !== 'null')
  if (t.includes('boolean')) return 'boolean'
  if (t.length > 0 && t.every((x) => x === 'number' || x === 'integer')) return 'number'
  if (t.includes('object') || t.includes('array')) return 'json'
  return 'string'
}

/** Groups are the first segment of the oRPC operationId (`contacts.list` → `contacts list`). */
export function kebab(input: string): string {
  return input.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
}

export function parseSpec(spec: OpenApiSpec): Operation[] {
  const operations: Operation[] = []
  for (const [path, methods] of Object.entries(spec.paths ?? {})) {
    for (const [method, op] of Object.entries(methods)) {
      const [group, action] = (op.operationId ?? '').split('.')
      // Public (unauthenticated) endpoints are not part of the CLI.
      if (!group || !action || group === 'public') continue

      const param = (p: NonNullable<OpenApiOperation['parameters']>[number]): Param => ({
        name: p.name,
        description: p.description,
        required: p.in === 'path' || !!p.required,
        kind: kindOf(p.schema),
      })
      const parameters = op.parameters ?? []
      const bodySchema = op.requestBody?.content?.['application/json']?.schema
      const required = new Set(bodySchema?.required ?? [])

      operations.push({
        group: kebab(group),
        action: kebab(action),
        method: method.toUpperCase(),
        path,
        summary: op.summary ?? '',
        pathParams: parameters.filter((p) => p.in === 'path').map(param),
        queryParams: parameters.filter((p) => p.in === 'query').map(param),
        bodyProps: Object.entries(bodySchema?.properties ?? {}).map(([name, schema]) => ({
          name,
          description: schema.description,
          required: required.has(name),
          kind: kindOf(schema),
        })),
      })
    }
  }
  return operations
}

export function groupOperations(operations: Operation[]): Map<string, Operation[]> {
  const groups = new Map<string, Operation[]>()
  for (const op of operations) groups.set(op.group, [...(groups.get(op.group) ?? []), op])
  return groups
}

export function coerce(kind: ArgKind, value: unknown, name: string): unknown {
  if (kind === 'string') return String(value)
  // A bare `--flag` arrives as '' and means true; `--flag false` stays false.
  if (kind === 'boolean') return value === true || value === '' || value === 'true'
  if (kind === 'number') {
    const n = Number(value)
    if (Number.isNaN(n)) throw new Error(`--${name} must be a number`)
    return n
  }
  try {
    return typeof value === 'string' ? JSON.parse(value) : value
  } catch {
    throw new Error(`--${name} must be valid JSON`)
  }
}
