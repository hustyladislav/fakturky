import { buildAgentTools } from '@fakturky/core/agent-tools'
import { expect, test } from 'vitest'
import { cs } from '../../i18n/cs'
import { clientToolDefinitions } from '../../lib/agent-client-tools'
import { buildServerTools } from '../../server/agent/tools'

// Every tool the model can call shows a Czech label in the panel — never a raw identifier.
test('all server and client tools have a Czech label', () => {
  const labels = new Set(Object.keys(cs.assistant.tools))
  const offered = (
    buildServerTools({
      db: undefined as never,
      principal: { userId: 'u', organizationId: 'o', via: 'assistant' },
    }) as unknown as { name: string }[]
  ).map((t) => t.name)
  expect(offered.length).toBeGreaterThan(0)
  for (const name of [...offered, ...clientToolDefinitions.map((t) => t.name)]) {
    expect(labels.has(name), name).toBe(true)
  }
  expect(buildAgentTools().length).toBeGreaterThanOrEqual(offered.length)
})
