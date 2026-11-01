import type { InferRouterInputs, InferRouterOutputs } from '@orpc/server'
import { bankAccountsRouter } from './bank-accounts'
import { contactsRouter } from './contacts'
import { documentsRouter } from './documents'

export const router = {
  bankAccounts: bankAccountsRouter,
  contacts: contactsRouter,
  documents: documentsRouter,
}

export type Router = typeof router
export type RouterInputs = InferRouterInputs<Router>
export type RouterOutputs = InferRouterOutputs<Router>
