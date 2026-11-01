import { readFile } from 'node:fs/promises'
import { type ArgsDef, type CommandDef, defineCommand } from 'citty'
import { type Credentials, request } from './api'
import { render } from './format'
import { coerce, groupOperations, type Operation } from './spec'

async function readData(source: string): Promise<Record<string, unknown>> {
  let text = source
  if (source === '-') {
    const chunks: Buffer[] = []
    for await (const chunk of process.stdin) chunks.push(chunk as Buffer)
    text = Buffer.concat(chunks).toString('utf8')
  } else if (source.startsWith('@')) {
    text = await readFile(source.slice(1), 'utf8')
  }
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    throw new Error('--data must be valid JSON (or @file.json, or - for stdin)')
  }
}

/** Run a command body; print just the message (no stack trace) and exit non-zero on failure. */
export async function guard(fn: () => Promise<void>): Promise<void> {
  try {
    await fn()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}

export function output(value: unknown, json: boolean): void {
  if (typeof value === 'string') process.stdout.write(value.endsWith('\n') ? value : `${value}\n`)
  else console.log(json ? JSON.stringify(value, null, 2) : render(value))
}

export function buildOperationCommand(
  op: Operation,
  getCredentials: () => Promise<Credentials>,
): CommandDef {
  const args: ArgsDef = {
    json: { type: 'boolean', description: 'Print raw JSON' },
  }
  for (const p of op.pathParams) {
    args[p.name] = { type: 'positional', required: true, description: p.description ?? p.name }
  }
  for (const p of op.queryParams) {
    args[p.name] = {
      type: 'string',
      description: p.kind === 'boolean' ? `${p.description ?? p.name} (true|false)` : p.description,
      required: p.required,
    }
  }
  for (const p of op.bodyProps) {
    args[p.name] = {
      type: 'string',
      description: p.kind === 'json' ? `${p.description ?? p.name} (JSON)` : p.description,
    }
  }
  if (op.bodyProps.length > 0) {
    args.data = { type: 'string', description: 'Request body as JSON, @file.json or - (stdin)' }
  }

  return defineCommand({
    meta: { name: op.action, description: `${op.summary} (${op.method} ${op.path})` },
    args,
    run: ({ args: given }) =>
      guard(async () => {
        const values = given as Record<string, unknown>
        let path = op.path
        for (const p of op.pathParams) {
          path = path.replace(`{${p.name}}`, encodeURIComponent(String(values[p.name])))
        }

        const query: Record<string, unknown> = {}
        for (const p of op.queryParams) {
          const v = values[p.name]
          if (v === undefined) continue
          query[p.name] = coerce(p.kind, v, p.name)
        }

        let body: Record<string, unknown> | undefined
        if (op.bodyProps.length > 0) {
          body = typeof values.data === 'string' ? await readData(values.data) : {}
          for (const p of op.bodyProps) {
            const v = values[p.name]
            if (v === undefined) continue
            body[p.name] = coerce(p.kind, v, p.name)
          }
        }

        const result = await request(await getCredentials(), op.method, path, { query, body })
        output(result, values.json === true)
      }),
  })
}

/** `fakturky <group> <action>` for every operation in the spec. */
export function buildGroupCommands(
  operations: Operation[],
  getCredentials: () => Promise<Credentials>,
): Record<string, CommandDef> {
  const groups: Record<string, CommandDef> = {}
  for (const [group, ops] of groupOperations(operations)) {
    groups[group] = defineCommand({
      meta: { name: group, description: `${group} (${ops.length} commands)` },
      subCommands: Object.fromEntries(
        ops.map((op) => [op.action, buildOperationCommand(op, getCredentials)]),
      ),
    })
  }
  return groups
}
