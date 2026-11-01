import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  resolve: { tsconfigPaths: true },
  server: { port: 3000 },
  plugins: [
    tailwindcss(),
    tanstackStart(),
    nitro({
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
