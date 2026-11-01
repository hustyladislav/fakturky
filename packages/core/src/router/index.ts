import type { InferRouterInputs, InferRouterOutputs } from '@orpc/server'
import { bankAccountsRouter } from './bank-accounts'
import { businessProfileRouter } from './business-profile'
import { contactsRouter } from './contacts'
import { documentsRouter } from './documents'
import { lookupRouter } from './lookup'
import { publicRouter } from './public'

export const router = {
  bankAccounts: bankAccountsRouter,
  businessProfile: businessProfileRouter,
  contacts: contactsRouter,
  documents: documentsRouter,
  lookup: lookupRouter,
  public: publicRouter,
}

export type Router = typeof router
export type RouterInputs = InferRouterInputs<Router>
export type RouterOutputs = InferRouterOutputs<Router>
