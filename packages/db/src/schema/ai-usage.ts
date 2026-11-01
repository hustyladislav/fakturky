import { index, integer, numeric, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { idColumn } from './helpers'

/**
 * One row per in-app assistant request (a run, or an approval resume). Written when the request is
 * accepted and incremented as the gateway reports usage — the source of truth for the hard spend cap.
 */
export const aiUsage = pgTable(
  'ai_usage',
  {
    id: idColumn(),
    // Deliberately no foreign keys: this is a spend ledger and must survive organization/user deletion,
    // otherwise deleting a tenant would lower the recorded monthly spend and re-open the cap.
    organizationId: text('organization_id').notNull(),
    userId: text('user_id').notNull(),
    model: text('model').notNull(),
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    totalTokens: integer('total_tokens').notNull().default(0),
    /** Gateway-reported cost in USD (what the key was debited), not a list-price estimate. */
    costUsd: numeric('cost_usd', { precision: 14, scale: 8 }).notNull().default('0'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('ai_usage_created_idx').on(t.createdAt),
    index('ai_usage_org_created_idx').on(t.organizationId, t.createdAt),
    index('ai_usage_user_created_idx').on(t.userId, t.createdAt),
  ],
)
