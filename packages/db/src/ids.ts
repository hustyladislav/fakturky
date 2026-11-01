import { v7 } from 'uuid'

/** Time-ordered UUID (v7), stored as text. */
export const newId = (): string => v7()
