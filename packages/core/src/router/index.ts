import type { InferRouterInputs, InferRouterOutputs } from '@orpc/server'
import { accountRouter } from '../account/router'
import { appearanceRouter } from '../appearance/router'
import { bankRouter } from '../bank/router'
import { bankAccountsRouter } from '../bank-accounts/router'
import { businessProfileRouter } from '../business-profile/router'
import { contactsRouter } from '../contacts/router'
import { dashboardRouter } from '../dashboard/router'
import { documentsRouter } from '../documents/router'
import { exportsRouter } from '../exports/router'
import { importRouter } from '../import/router'
import { lookupRouter } from '../lookup/router'
import { numberSeriesRouter } from '../number-series/router'
import { publicRouter } from '../public/router'
import { searchRouter } from '../search/router'
import { recurringRouter, templatesRouter } from '../templates/router'
import { vatRouter } from '../vat/router'

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
