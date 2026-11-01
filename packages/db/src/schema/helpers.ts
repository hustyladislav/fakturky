import { numeric, text, timestamp } from 'drizzle-orm/pg-core'
import { newId } from '../ids'
import { organization } from './auth'

export const idColumn = () =>
  text('id')
    .primaryKey()
    .$defaultFn(() => newId())

export const orgColumn = () =>
  text('organization_id')
    .notNull()
    .references(() => organization.id, { onDelete: 'cascade' })

export const timestamps = () => ({
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
})

/** Money: decimal string, 4 fractional digits of headroom. Never use JS numbers. */
export const money = (name: string) => numeric(name, { precision: 19, scale: 4 })
