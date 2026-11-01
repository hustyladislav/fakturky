import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'

/** Mirror of a Clerk Organization (id = Clerk org id). Members and invitations live in Clerk. */
export const organization = pgTable('organization', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
