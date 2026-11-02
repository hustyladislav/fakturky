export type ToolPart = {
  type: 'tool-call'
  id: string
  name: string
  arguments: string
  state: string
  output?: { ok?: boolean; result?: unknown }
  approval?: { id: string; needsApproval: boolean; approved?: boolean }
}
export type Part = { type: 'text'; content: string } | ToolPart

export const toolFailed = (p: ToolPart) => p.state === 'error' || p.output?.ok === false
const toolOk = (p: ToolPart) => !toolFailed(p) && (p.state === 'complete' || p.output?.ok === true)

export type TurnMessage = { role: string; parts: ReadonlyArray<Part> }

/**
 * Ids of failed steps that a later step of the same tool in the same turn (since the user's last
 * message) repeated successfully: the model retried, so the visible failure is noise.
 */
export function recoveredFailures(messages: ReadonlyArray<TurnMessage>): Set<string> {
  const hidden = new Set<string>()
  let turn: ToolPart[] = []
  const flush = () => {
    turn.forEach((p, i) => {
      if (toolFailed(p) && turn.slice(i + 1).some((q) => q.name === p.name && toolOk(q))) {
        hidden.add(p.id)
      }
    })
    turn = []
  }
  for (const m of messages) {
    if (m.role === 'user') flush()
    else for (const p of m.parts) if (p.type === 'tool-call') turn.push(p)
  }
  flush()
  return hidden
}

/** Id of the document a successful result points at, to link "Otevřít fakturu". */
export function resultDocumentId(part: ToolPart): string | null {
  const r = part.output?.result
  if (part.output?.ok !== true || !r || typeof r !== 'object') return null
  const id = (r as { id?: unknown }).id
  return typeof id === 'string' ? id : null
}
