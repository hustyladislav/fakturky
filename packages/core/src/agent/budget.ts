import { type Decimal, parseDecimal } from '@fakturky/domain/money'

/** Spend limits for the assistant. All amounts are USD, as reported by the gateway. */
export type BudgetLimits = {
  /** Hard cap for the whole deployment per calendar month (UTC). */
  globalMonthlyUsd: Decimal
  /** Cap per organization per calendar month (UTC). */
  orgMonthlyUsd: Decimal
  /** Max assistant requests per user in any rolling minute. */
  userPerMinute: number
  /** Max assistant requests per user in any rolling hour. */
  userPerHour: number
}

export type BudgetUsage = {
  globalMonthUsd: Decimal
  orgMonthUsd: Decimal
  userLastMinute: number
  userLastHour: number
}

export type BudgetDecision =
  | { ok: true }
  | { ok: false; reason: 'global_budget' | 'org_budget' | 'rate_limit' }

export const DEFAULT_LIMITS = {
  globalMonthlyUsd: '100',
  orgMonthlyUsd: '2',
  userPerMinute: 10,
  userPerHour: 60,
}

function positive(raw: string | undefined, fallback: string): Decimal {
  if (raw === undefined || raw.trim() === '') return parseDecimal(fallback)
  try {
    const value = parseDecimal(raw.trim())
    return value.isNegative() ? parseDecimal(fallback) : value
  } catch {
    return parseDecimal(fallback)
  }
}

function positiveInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw)
  return Number.isInteger(n) && n > 0 ? n : fallback
}

/** Limits from the environment; malformed values fall back to the defaults (never to "unlimited"). */
export function limitsFromEnv(env: Record<string, string | undefined>): BudgetLimits {
  return {
    globalMonthlyUsd: positive(env.AI_MONTHLY_BUDGET_USD, DEFAULT_LIMITS.globalMonthlyUsd),
    orgMonthlyUsd: positive(env.AI_ORG_MONTHLY_USD, DEFAULT_LIMITS.orgMonthlyUsd),
    userPerMinute: positiveInt(env.AI_USER_PER_MINUTE, DEFAULT_LIMITS.userPerMinute),
    userPerHour: positiveInt(env.AI_USER_PER_HOUR, DEFAULT_LIMITS.userPerHour),
  }
}

/**
 * Pure policy: may this request start? Order matters — the global cap wins over the organization cap,
 * which wins over the rate limit, so users see the most fundamental reason.
 */
export function evaluateBudget(limits: BudgetLimits, usage: BudgetUsage): BudgetDecision {
  if (usage.globalMonthUsd.gte(limits.globalMonthlyUsd)) {
    return { ok: false, reason: 'global_budget' }
  }
  if (usage.orgMonthUsd.gte(limits.orgMonthlyUsd)) return { ok: false, reason: 'org_budget' }
  if (usage.userLastMinute >= limits.userPerMinute || usage.userLastHour >= limits.userPerHour) {
    return { ok: false, reason: 'rate_limit' }
  }
  return { ok: true }
}

/** First instant of the current calendar month in UTC (the budget period boundary). */
export function startOfMonthUtc(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}

const QUOTA_TEXT =
  /\b402\b|quota_for_entity_exceeded|quota.*exceeded|insufficient[_ ](funds|credit|quota)|payment required/i

/**
 * Gateway signals that the key or team ran out of money (HTTP 402, `quota_for_entity_exceeded`,
 * "insufficient funds" …). Looks at status codes, error codes and message text, because adapters surface
 * the failure in different shapes.
 */
export function isGatewayQuotaError(error: unknown): boolean {
  if (typeof error === 'string') return QUOTA_TEXT.test(error)
  if (!error || typeof error !== 'object') return false
  const e = error as { status?: unknown; statusCode?: unknown; code?: unknown; message?: unknown }
  if (e.status === 402 || e.statusCode === 402) return true
  const code = typeof e.code === 'string' ? e.code : String(e.code ?? '')
  const message = typeof e.message === 'string' ? e.message : ''
  return QUOTA_TEXT.test(`${code} ${message}`)
}

export type AgentLimitReason = BudgetDecisionReason | 'gateway_quota'
type BudgetDecisionReason = Extract<BudgetDecision, { ok: false }>['reason']

/**
 * Stable codes sent to the client with a run error. The Czech copy lives in `apps/web/src/i18n/cs.ts`;
 * the server never ships user-facing strings.
 */
export const LIMIT_ERROR_CODES: Record<AgentLimitReason, string> = {
  rate_limit: 'assistant_limit_rate',
  org_budget: 'assistant_limit_org',
  global_budget: 'assistant_limit_global',
  gateway_quota: 'assistant_limit_gateway',
}

/** Whether the "Kupte mi kávu" link is shown: only where money is the reason, not a rate limit. */
export function limitShowsCoffee(reason: AgentLimitReason): boolean {
  return reason !== 'rate_limit'
}
