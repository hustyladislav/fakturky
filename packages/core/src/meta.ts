export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export type ProcedureMeta = {
  /** Exposed as an MCP tool when present. */
  mcp?: {
    name: string
    title: string
    readOnly?: boolean
    destructive?: boolean
    idempotent?: boolean
  }
  /** Exposed on the REST API (`/api/v1`) when present. */
  openapi?: {
    method: HttpMethod
    path: `/${string}`
    summary: string
    tags?: string[]
  }
}
