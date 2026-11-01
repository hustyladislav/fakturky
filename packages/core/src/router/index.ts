import type { InferRouterInputs, InferRouterOutputs } from '@orpc/server'
import { bankAccountsRouter } from './bank-accounts'
import { businessProfileRouter } from './business-profile'
import { contactsRouter } from './contacts'

export const router = {
  bankAccounts: bankAccountsRouter,
  businessProfile: businessProfileRouter,
  contacts: contactsRouter,
}

export type Router = typeof router
export type RouterInputs = InferRouterInputs<Router>
export type RouterOutputs = InferRouterOutputs<Router>
