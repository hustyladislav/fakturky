import { BRAND } from '@fakturky/core/brand'
import { router } from '@fakturky/core/router'
import { OpenAPIGenerator } from '@orpc/openapi'
import { OpenAPIHandler } from '@orpc/openapi/fetch'
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4'
import { createContext } from './context'

const handler = new OpenAPIHandler(router)

export async function handleRest(request: Request): Promise<Response> {
  const { response } = await handler.handle(request, {
    prefix: '/api/v1',
    context: await createContext(request.headers),
  })
  return response ?? new Response('Not found', { status: 404 })
}

export async function openApiSpec(origin: string) {
  const generator = new OpenAPIGenerator({ schemaConverters: [new ZodToJsonSchemaConverter()] })
  return generator.generate(router, {
    info: { title: `${BRAND.name} API`, version: '1.0.0' },
    servers: [{ url: `${origin}/api/v1` }],
    security: [{ apiKey: [] }],
    components: {
      securitySchemes: {
        apiKey: { type: 'http', scheme: 'bearer', description: `API key (${BRAND.apiKeyPrefix}…)` },
      },
    },
  })
}
