# In-app agent research (2026-11-01)

## Packages
`@tanstack/ai` 1.0.1, `@tanstack/ai-react` 1.0.1, `@tanstack/ai-client` 1.0.1, `@tanstack/ai-vercel-gateway` 1.0.0.
Adapter: `vercelGatewayText('deepseek/deepseek-v4-flash', { api: 'chat' })` (DeepSeek documents Chat Completions).
Auth: `AI_GATEWAY_API_KEY` (set in Vercel for prod/preview/dev; key `fakturky-agent` has a $100/month quota;
team budget $100/month as backstop). Over-limit → HTTP 402 `quota_for_entity_exceeded` (soft cap) — handle it.

## Route pattern
```ts
const p = await chatParamsFromRequest(request)
const stream = chat({
  adapter: vercelGatewayText('deepseek/deepseek-v4-flash', { api: 'chat' }),
  messages: p.messages, threadId: p.threadId, runId: p.runId, parentRunId: p.parentRunId,
  ...(p.resume ? { resume: p.resume } : {}),
  systemPrompts: [...], tools: [...], agentLoopStrategy: maxIterations(8),
  modelOptions: { gateway: { zeroDataRetention: true /* + inferenceRegion us (may need cast) */ } },
  middleware: [{ name: 'cost', onUsage: (ctx, u) => recordUsage(u.cost, u.totalTokens) }],
})
return toServerSentEventsResponse(stream)
```
Tools: `toolDefinition({ name, description, inputSchema, outputSchema, needsApproval })` + `.server(fn)` or
`.client(fn)`. Client: `useChat({ connection: fetchServerSentEvents('/api/agent'), tools: clientTools(...) })`.
Approvals: `useChat().interrupts` filter `kind === 'tool-approval'` → `resolveInterrupt(true|false)`.
Cost: `usage.cost` (USD number) on RUN_FINISHED / middleware `onUsage`.

## Model & routing
- `deepseek/deepseek-v4-flash` (1M ctx, tool-use). Region pin: **US only** (Baseten, ZDR, ~$0.13/$0.26 per 1M).
  `providerOptions.gateway.inferenceRegion = { scope: 'zone', geoRegion: 'us' }` → 400 if unservable.
- EU-capable fallbacks: `google/gemini-2.5-flash-lite`, `anthropic/claude-haiku-5.5`, `amazon/nova-lite` (verify live).
- Use `zeroDataRetention: true`.

## UI
AI Elements is being folded into shadcn/ui (deprecated end of Nov 2026) — use shadcn's own components:
`npx shadcn@latest add message-scroller message bubble input-group attachment item trace code-block`
(+ `reasoning`, `suggestion`, `task`). They don't depend on the AI SDK; map TanStack `UIMessage.parts` yourself.
Approval card = shadcn `Item` driven by TanStack `interrupts`.

## UX (Linear-inspired)
⌘J opens the assistant panel, ⌘K palette has "Zeptat se asistenta"; agent acts within the user's permissions;
context = current route + selected entity + @mentions; AI-created invoices land as "Koncept · navrhl asistent"
for the human to accept.
