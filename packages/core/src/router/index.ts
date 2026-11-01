import type { InferRouterInputs, InferRouterOutputs } from '@orpc/server'
import { contactsRouter } from './contacts'

export const router = {
  contacts: contactsRouter,
}

export type Router = typeof router
export type RouterInputs = InferRouterInputs<Router>
export type RouterOutputs = InferRouterOutputs<Router>
