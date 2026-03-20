import { defineConfig, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'

const packageJson = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf-8'),
) as { version?: string }

const appVersion = packageJson.version ?? '0.0.0-dev'

async function resolvePwaPlugin(): Promise<PluginOption | null> {
  try {
    const { VitePWA } = await import('vite-plugin-pwa')

    return VitePWA({
      registerType: 'prompt',
      includeAssets: ['vite.svg'],
      manifest: {
        name: 'AB Generator',
        short_name: 'ABGen',
        description: 'Arbeitsblatt-Generator für Unterrichtsmaterialien',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/vite.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
      },
    })
  } catch {
    console.warn('[vite] vite-plugin-pwa not installed yet, PWA disabled for this run.')
    return null
  }
}

// https://vite.dev/config/
export default defineConfig(async () => {
  const pwaPlugin = await resolvePwaPlugin()

  return {
    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (!id.includes('node_modules')) return

            if (id.includes('/node_modules/pdfjs-dist/')) return 'vendor-pdfjs'
            if (id.includes('/node_modules/katex/')) return 'vendor-katex'

            if (
              id.includes('/node_modules/@tiptap/') ||
              id.includes('/node_modules/prosemirror-') ||
              id.includes('/node_modules/orderedmap/')
            ) {
              return 'vendor-editor'
            }

            if (id.includes('/node_modules/lucide-react/')) return 'vendor-icons'
            if (id.includes('/node_modules/@dnd-kit/')) return 'vendor-dnd'
            if (id.includes('/node_modules/@google/generative-ai/')) return 'vendor-ai'
            if (id.includes('/node_modules/react-joyride/')) return 'vendor-joyride'

            if (id.includes('/node_modules/docx/')) return 'vendor-docx'
            if (id.includes('/node_modules/mammoth/')) return 'vendor-mammoth'
            if (id.includes('/node_modules/file-saver/')) return 'vendor-file-saver'
            if (
              id.includes('/node_modules/jszip/') ||
              id.includes('/node_modules/pako/')
            ) {
              return 'vendor-zip'
            }

            if (
              id.includes('/node_modules/react/') ||
              id.includes('/node_modules/react-dom/') ||
              id.includes('/node_modules/scheduler/')
            ) {
              return 'vendor-react'
            }

            if (
              id.includes('/node_modules/zustand/') ||
              id.includes('/node_modules/dexie/')
            ) {
              return 'vendor-state'
            }
          },
        },
      },
    },
    plugins: [
      react(),
      tailwindcss(),
      ...(pwaPlugin ? [pwaPlugin] : []),
    ],
  }
})
