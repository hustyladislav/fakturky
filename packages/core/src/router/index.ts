import type { InferRouterInputs, InferRouterOutputs } from '@orpc/server'
import { accountRouter } from './account'
import { appearanceRouter } from './appearance'
import { bankRouter } from './bank'
import { bankAccountsRouter } from './bank-accounts'
import { businessProfileRouter } from './business-profile'
import { contactsRouter } from './contacts'
import { dashboardRouter } from './dashboard'
import { documentsRouter } from './documents'
import { exportsRouter } from './exports'
import { importRouter } from './import'
import { lookupRouter } from './lookup'
import { numberSeriesRouter } from './number-series'
import { publicRouter } from './public'
import { searchRouter } from './search'
import { recurringRouter, templatesRouter } from './templates'
import { vatRouter } from './vat'

export const router = {
  account: accountRouter,
  appearance: appearanceRouter,
  bank: bankRouter,
  bankAccounts: bankAccountsRouter,
  businessProfile: businessProfileRouter,
  contacts: contactsRouter,
  dashboard: dashboardRouter,
  documents: documentsRouter,
  exports: exportsRouter,
  import: importRouter,
  lookup: lookupRouter,
  numberSeries: numberSeriesRouter,
  public: publicRouter,
  search: searchRouter,
  recurring: recurringRouter,
  templates: templatesRouter,
  vat: vatRouter,
}

export type Router = typeof router
export type RouterInputs = InferRouterInputs<Router>
export type RouterOutputs = InferRouterOutputs<Router>
