import type { InferRouterInputs, InferRouterOutputs } from '@orpc/server'
import { bankAccountsRouter } from './bank-accounts'
import { businessProfileRouter } from './business-profile'
import { contactsRouter } from './contacts'
import { dashboardRouter } from './dashboard'
import { documentsRouter } from './documents'
import { lookupRouter } from './lookup'
import { publicRouter } from './public'
import { recurringRouter, templatesRouter } from './templates'

export const router = {
  bankAccounts: bankAccountsRouter,
  businessProfile: businessProfileRouter,
  contacts: contactsRouter,
  dashboard: dashboardRouter,
  documents: documentsRouter,
  lookup: lookupRouter,
  public: publicRouter,
  recurring: recurringRouter,
  templates: templatesRouter,
}

export type Router = typeof router
export type RouterInputs = InferRouterInputs<Router>
export type RouterOutputs = InferRouterOutputs<Router>
