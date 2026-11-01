import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  resolve: { tsconfigPaths: true },
  server: { port: 3000 },
  // Vercel's Clerk integration exposes the publishable key as NEXT_PUBLIC_*.
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  plugins: [tailwindcss(), tanstackStart(), nitro(), viteReact()],
})
