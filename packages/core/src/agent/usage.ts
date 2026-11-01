import { type Db, schema } from '@fakturky/db'
import { type MoneyInput, parseDecimal } from '@fakturky/domain/money'
import { and, count, eq, gte, sql } from 'drizzle-orm'
import {
  type BudgetDecision,
  type BudgetLimits,
  type BudgetUsage,
  evaluateBudget,
  startOfMonthUtc,
} from './budget'

const { aiUsage } = schema

export type UsageScope = { organizationId: string; userId: string }

/** Serializes admission decisions (check + reserve) across all instances. Arbitrary constant. */
const ADMISSION_LOCK_KEY = 7_302_026_001

type Executor = Pick<Db, 'select' | 'insert' | 'update'>

/** Deployment-wide aggregate for the global cap; returns one number, no tenant rows. */
async function sumCostGlobal(db: Executor, since: Date) {
  const [row] = await db
    .select({ total: sql<string>`coalesce(sum(${aiUsage.costUsd}), 0)` })
    .from(aiUsage)
    .where(gte(aiUsage.createdAt, since))
  return parseDecimal(row?.total ?? '0')
}

async function sumCostForOrg(db: Executor, organizationId: string, since: Date) {
  const [row] = await db
    .select({ total: sql<string>`coalesce(sum(${aiUsage.costUsd}), 0)` })
    .from(aiUsage)
    .where(and(eq(aiUsage.organizationId, organizationId), gte(aiUsage.createdAt, since)))
  return parseDecimal(row?.total ?? '0')
}

async function countRequests(db: Executor, scope: UsageScope, since: Date) {
  const [row] = await db
    .select({ n: count() })
    .from(aiUsage)
    // Per user across all of their organizations: switching organization must not reset the allowance.
    .where(and(eq(aiUsage.userId, scope.userId), gte(aiUsage.createdAt, since)))
  return row?.n ?? 0
}

async function loadUsage(db: Executor, scope: UsageScope, now: Date): Promise<BudgetUsage> {
  const month = startOfMonthUtc(now)
  const [globalMonthUsd, orgMonthUsd, userLastMinute, userLastHour] = await Promise.all([
    sumCostGlobal(db, month),
    sumCostForOrg(db, scope.organizationId, month),
    countRequests(db, scope, new Date(now.getTime() - 60_000)),
    countRequests(db, scope, new Date(now.getTime() - 3_600_000)),
  ])
  return { globalMonthUsd, orgMonthUsd, userLastMinute, userLastHour }
}

/** Month-to-date spend (global + org) and the user's recent request counts. */
export function loadBudgetUsage(db: Db, scope: UsageScope, now: Date = new Date()) {
  return loadUsage(db, scope, now)
}

/** Read-only budget check (no reservation). Use `admitRequest` to start a request. */
export async function checkBudget(
  db: Db,
  scope: UsageScope,
  limits: BudgetLimits,
  now: Date = new Date(),
): Promise<BudgetDecision> {
  return evaluateBudget(limits, await loadUsage(db, scope, now))
}

/** `numeric`-safe decimal string for a gateway-reported cost (never negative, 8 fractional digits). */
export function costToNumeric(cost: MoneyInput | undefined): string {
  if (cost === undefined) return '0.00000000'
  try {
    const value = parseDecimal(cost)
    return value.isNegative() ? '0.00000000' : value.toFixed(8)
  } catch {
    return '0.00000000'
  }
}

function recorder(db: Db, scope: UsageScope, id: string) {
  return {
    id,
    /** Adds one model call's usage. `costUsd` is the gateway-reported cost (0 when unknown). */
    async add(usage: {
      inputTokens?: number
      outputTokens?: number
      totalTokens?: number
      costUsd?: MoneyInput
      model?: string
    }) {
      await db
        .update(aiUsage)
        .set({
          inputTokens: sql`${aiUsage.inputTokens} + ${Math.trunc(usage.inputTokens ?? 0)}`,
          outputTokens: sql`${aiUsage.outputTokens} + ${Math.trunc(usage.outputTokens ?? 0)}`,
          totalTokens: sql`${aiUsage.totalTokens} + ${Math.trunc(usage.totalTokens ?? 0)}`,
          costUsd: sql`${aiUsage.costUsd} + ${costToNumeric(usage.costUsd)}::numeric`,
          ...(usage.model ? { model: usage.model } : {}),
        })
        .where(and(eq(aiUsage.id, id), eq(aiUsage.organizationId, scope.organizationId)))
    },
  }
}

export type UsageRecorder = ReturnType<typeof recorder>

export type Admission =
  | { ok: true; usage: UsageRecorder }
  | { ok: false; reason: Extract<BudgetDecision, { ok: false }>['reason'] }

/**
 * Decides whether a request may start and, if so, reserves its usage row in the same serialized
 * transaction — concurrent requests cannot all pass the check before any of them is counted.
 * (The cost of runs already in flight is only known as the gateway reports it, so a burst can overshoot
 * a cap by at most the cost of the requests the rate limit lets through.)
 */
export async function admitRequest(
  db: Db,
  scope: UsageScope & { model: string },
  limits: BudgetLimits,
  now: Date = new Date(),
): Promise<Admission> {
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${ADMISSION_LOCK_KEY})`)
    const decision = evaluateBudget(limits, await loadUsage(tx, scope, now))
    if (!decision.ok) return decision
    const [row] = await tx
      .insert(aiUsage)
      .values({ organizationId: scope.organizationId, userId: scope.userId, model: scope.model })
      .returning({ id: aiUsage.id })
    if (!row) throw new Error('ai_usage insert returned no row')
    return { ok: true as const, id: row.id }
  })
  return result.ok ? { ok: true, usage: recorder(db, scope, result.id) } : result
}

/** Opens a usage row without a budget check (tests, internal tooling). */
export async function startUsage(db: Db, scope: UsageScope & { model: string }) {
  const [row] = await db
    .insert(aiUsage)
    .values({ organizationId: scope.organizationId, userId: scope.userId, model: scope.model })
    .returning({ id: aiUsage.id })
  if (!row) throw new Error('ai_usage insert returned no row')
  return recorder(db, scope, row.id)
}
