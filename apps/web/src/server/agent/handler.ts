import {
  AGENT_MAX_ITERATIONS,
  AGENT_MAX_OUTPUT_TOKENS,
  AGENT_MODEL,
  type AgentLimitReason,
  admitRequest,
  buildSystemPrompt,
  gatewayOptions,
  isGatewayQuotaError,
  LIMIT_ERROR_CODES,
  limitsFromEnv,
  sanitizePageContext,
} from '@fakturky/core/agent'
import type { BaseContext } from '@fakturky/core/context'
import {
  type ChatMiddleware,
  chat,
  chatParamsFromRequestBody,
  EventType,
  maxIterations,
  type StreamChunk,
  toServerSentEventsResponse,
} from '@tanstack/ai'
import { vercelGatewayText } from '@tanstack/ai-vercel-gateway'
import { clientToolDefinitions } from '../../components/assistant/agent-client-tools'
import { buildServerTools } from './tools'

/** Conversations are small; anything bigger is a bug or abuse and would also be expensive. */
const MAX_BODY_BYTES = 512 * 1024

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })

/**
 * Run errors carry a stable `code` (and a neutral English message for logs); the Czech copy is resolved
 * by the web client from `i18n/cs.ts`. `assistant_error` = anything else.
 */
const GENERIC_CODE = 'assistant_error'
const GENERIC_MESSAGE = 'The assistant could not answer.'

function limitChunk(reason: AgentLimitReason) {
  return { message: `Assistant limit reached (${reason}).`, code: LIMIT_ERROR_CODES[reason] }
}

/** Reads the JSON body while counting bytes, so a missing/forged Content-Length cannot bypass the cap. */
async function readLimitedJson(request: Request, max: number): Promise<unknown> {
  if (Number(request.headers.get('content-length') ?? 0) > max) return 'too-large'
  const reader = request.body?.getReader()
  if (!reader) return 'invalid'
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > max) {
      await reader.cancel().catch(() => undefined)
      return 'too-large'
    }
    chunks.push(value)
  }
  try {
    return JSON.parse(new TextDecoder().decode(Buffer.concat(chunks)))
  } catch {
    return 'invalid'
  }
}

/** A well-formed stream that fails immediately — the client handles it like any other run error. */
function errorStream(params: { threadId: string; runId: string }, message: string, code: string) {
  return toServerSentEventsResponse(
    (async function* (): AsyncGenerator<StreamChunk> {
      yield {
        type: EventType.RUN_STARTED,
        threadId: params.threadId,
        runId: params.runId,
        timestamp: Date.now(),
      } as StreamChunk
      yield { type: EventType.RUN_ERROR, message, code, timestamp: Date.now() } as StreamChunk
    })(),
  )
}

/** Rewrites run errors: gateway quota → limit code; everything else → generic code (no provider details leak). */
async function* friendlyErrors(source: AsyncIterable<StreamChunk>): AsyncGenerator<StreamChunk> {
  try {
    for await (const chunk of source) {
      if (chunk.type === EventType.RUN_ERROR) {
        if (isGatewayQuotaError(chunk) || isGatewayQuotaError(chunk.error)) {
          yield { ...chunk, ...limitChunk('gateway_quota'), error: undefined, rawEvent: undefined }
        } else {
          console.error('[agent] run error', chunk.code, chunk.message)
          yield {
            ...chunk,
            message: GENERIC_MESSAGE,
            code: GENERIC_CODE,
            error: undefined,
            rawEvent: undefined,
          }
        }
        continue
      }
      yield chunk
    }
  } catch (error) {
    console.error('[agent] stream failed', error)
    yield {
      type: EventType.RUN_ERROR,
      timestamp: Date.now(),
      ...(isGatewayQuotaError(error)
        ? limitChunk('gateway_quota')
        : { message: GENERIC_MESSAGE, code: GENERIC_CODE }),
    } as StreamChunk
  }
}

export async function handleAgentRequest(request: Request, ctx: BaseContext): Promise<Response> {
  const principal = ctx.principal
  // Interactive sessions only — API keys are for the REST/MCP surface, not the assistant.
  if (!principal || principal.via !== 'session') return json(401, { error: 'UNAUTHORIZED' })

  if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN) {
    return json(503, { error: 'ASSISTANT_NOT_CONFIGURED' })
  }
  const body = await readLimitedJson(request, MAX_BODY_BYTES)
  if (body === 'too-large') return json(413, { error: 'PAYLOAD_TOO_LARGE' })
  if (body === 'invalid') return json(400, { error: 'INVALID_BODY' })
  const params = await chatParamsFromRequestBody(body).catch(() => null)
  if (!params) return json(400, { error: 'INVALID_BODY' })

  const admission = await admitRequest(
    ctx.db,
    { ...principal, model: AGENT_MODEL },
    limitsFromEnv(process.env),
  )
  if (!admission.ok) {
    const { message, code } = limitChunk(admission.reason)
    return errorStream(params, message, code)
  }
  const usage = admission.usage
  const costMiddleware: ChatMiddleware = {
    name: 'cost',
    onUsage: async (_ctx, u) => {
      try {
        await usage.add({
          inputTokens: u.promptTokens,
          outputTokens: u.completionTokens,
          totalTokens: u.totalTokens,
          costUsd: u.cost,
        })
      } catch (error) {
        console.error('[agent] failed to record usage', error)
      }
    },
  }
  const assistantPrincipal = { ...principal, via: 'assistant' as const }
  const page = sanitizePageContext(params.forwardedProps?.context)

  // Stop paying for tokens nobody reads when the user closes the tab or presses stop.
  const abortController = new AbortController()
  request.signal.addEventListener('abort', () => abortController.abort(), { once: true })

  const stream = chat({
    adapter: vercelGatewayText(AGENT_MODEL, { api: 'chat' }),
    messages: params.messages,
    threadId: params.threadId,
    runId: params.runId,
    ...(params.parentRunId ? { parentRunId: params.parentRunId } : {}),
    ...(params.resume ? { resume: params.resume } : {}),
    systemPrompts: [buildSystemPrompt({ page })],
    // Server tools run here; client tools are declared (no execute) and run in the browser.
    tools: [
      ...buildServerTools({ db: ctx.db, principal: assistantPrincipal, services: ctx.services }),
      ...clientToolDefinitions,
    ],
    agentLoopStrategy: maxIterations(AGENT_MAX_ITERATIONS),
    modelOptions: {
      max_tokens: AGENT_MAX_OUTPUT_TOKENS,
      user: principal.userId,
      // inferenceRegion is a gateway option the adapter types do not list yet; it is passed through verbatim.
      gateway: gatewayOptions(process.env) as never,
    },
    abortController,
    middleware: [costMiddleware],
  } as never) as AsyncIterable<StreamChunk>

  return toServerSentEventsResponse(friendlyErrors(stream), { abortController })
}
