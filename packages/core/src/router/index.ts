import type { InferRouterInputs, InferRouterOutputs } from '@orpc/server'
import { businessProfileRouter } from './business-profile'
import { contactsRouter } from './contacts'

export const router = {
  businessProfile: businessProfileRouter,
  contacts: contactsRouter,
}

export type Router = typeof router
export type RouterInputs = InferRouterInputs<Router>
export type RouterOutputs = InferRouterOutputs<Router>
