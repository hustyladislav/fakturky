import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import { defineConfig } from 'vite'
import { STATIC_SECURITY_HEADERS, TOKEN_PATH_HEADERS } from './src/server/security-headers'

export default defineConfig({
  resolve: { tsconfigPaths: true },
  server: { port: 3000 },
  plugins: [
    tailwindcss(),
    tanstackStart(),
    nitro({
      // Baseline security headers on every response, static assets included.
      routeRules: {
        '/**': { headers: STATIC_SECURITY_HEADERS },
        '/f/**': { headers: TOKEN_PATH_HEADERS },
        // The worker script itself must always be revalidated so updates reach installed apps.
        '/sw.js': { headers: { ...STATIC_SECURITY_HEADERS, 'cache-control': 'no-cache' } },
      },
      // The PDF fonts are read at runtime; bundle them as server assets so they exist on serverless hosts.
      serverAssets: [
        {
          baseName: 'pdf-fonts',
          dir: fileURLToPath(new URL('../../packages/pdf/fonts', import.meta.url)),
        },
      ],
    }),
    viteReact(),
  ],
})
