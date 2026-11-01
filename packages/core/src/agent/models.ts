/**
 * Model + request limits for the in-app assistant. Server-side constants — the client never picks the model.
 *
 * `deepseek/deepseek-v4.1-flash` is the newest DeepSeek Flash alias on the Vercel AI Gateway (verified live
 * against https://ai-gateway.vercel.sh/v1/models, 2026-11-01; dated snapshots like `-1017` exist but the
 * alias follows upstream fixes). Re-check when bumping.
 */
export const AGENT_MODEL = 'deepseek/deepseek-v4.1-flash'

/**
 * Tried by the gateway in order when the primary model/provider is unavailable.
 * Chosen to be cheap and tool-capable; they are not pinned to the US region (see AGENT_GATEWAY_OPTIONS).
 */
export const AGENT_FALLBACK_MODELS = ['google/gemini-3.5-flash-lite', 'anthropic/claude-haiku-5.5']

/** Max model round-trips (tool loops) in one request. */
export const AGENT_MAX_ITERATIONS = 8

/** Upper bound for tokens generated in one model call. */
export const AGENT_MAX_OUTPUT_TOKENS = 2048

/**
 * Gateway routing for every request: US inference region for the primary model and no training on
 * prompts at any provider. Requests that cannot be served that way fail instead of silently relaxing
 * the guarantee. Zero data retention is opt-in (`AI_ZERO_DATA_RETENTION=1`) because the gateway only
 * offers it on Pro/Enterprise teams (a Hobby team gets HTTP 403 `ZdrUnauthorizedError`).
 */
export function gatewayOptions(env: Record<string, string | undefined> = {}) {
  return {
    ...(env.AI_ZERO_DATA_RETENTION === '1' ? { zeroDataRetention: true } : {}),
    disallowPromptTraining: true,
    inferenceRegion: { scope: 'zone', geoRegion: 'us' },
    models: [...AGENT_FALLBACK_MODELS],
  }
}

/** Tools that always need explicit approval in addition to those flagged `destructive`. */
export const ALWAYS_APPROVE_TOOLS: ReadonlySet<string> = new Set([
  'issue_invoice',
  'mark_document_paid',
  'update_business_profile',
])
