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
    plugins: [
      react(),
      tailwindcss(),
      ...(pwaPlugin ? [pwaPlugin] : []),
    ],
  }
})
