import { defineConfig, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'
import { Readable } from 'node:stream'
import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'node:http'

const packageJson = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf-8'),
) as { version?: string }

const appVersion = packageJson.version ?? '0.0.0-dev'
const FUNCTION_ROUTE_MODULES: Record<string, string> = {
  '/api/generate-worksheet': '/functions/api/generate-worksheet.ts',
  '/api/modify-task': '/functions/api/modify-task.ts',
}

function toFetchHeaders(headers: IncomingHttpHeaders): Headers {
  const result = new Headers()

  for (const [key, value] of Object.entries(headers)) {
    if (value == null) continue

    if (Array.isArray(value)) {
      for (const entry of value) result.append(key, entry)
      continue
    }

    result.set(key, value)
  }

  return result
}

async function readRequestBody(req: IncomingMessage): Promise<Uint8Array | undefined> {
  if (req.method === 'GET' || req.method === 'HEAD') return undefined

  const chunks: Buffer[] = []
  await new Promise<void>((resolve, reject) => {
    req.on('data', (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    })
    req.on('end', resolve)
    req.on('error', reject)
  })

  if (chunks.length === 0) return undefined
  return Buffer.concat(chunks)
}

async function writeFetchResponseToNode(res: ServerResponse, response: Response): Promise<void> {
  res.statusCode = response.status
  response.headers.forEach((value, key) => {
    res.setHeader(key, value)
  })

  if (!response.body) {
    res.end()
    return
  }

  await new Promise<void>((resolve, reject) => {
    const stream = Readable.fromWeb(response.body as unknown as ReadableStream<Uint8Array>)
    const finish = () => {
      res.off('close', onClose)
      stream.off('error', onStreamError)
      resolve()
    }
    const onClose = () => {
      res.off('finish', finish)
      stream.off('error', onStreamError)
      resolve()
    }
    const onStreamError = (error: Error) => {
      res.off('finish', finish)
      res.off('close', onClose)
      reject(error)
    }

    res.once('finish', finish)
    res.once('close', onClose)
    stream.once('error', onStreamError)
    stream.pipe(res)
  })
}

function cloudflareFunctionsDevBridge(): PluginOption {
  return {
    name: 'cloudflare-functions-dev-bridge',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url
          ? new URL(req.url, `http://${req.headers.host ?? 'localhost'}`)
          : null

        if (!url) {
          next()
          return
        }

        const functionModulePath = FUNCTION_ROUTE_MODULES[url.pathname]
        if (!functionModulePath) {
          next()
          return
        }

        try {
          const body = await readRequestBody(req)
          const request = new Request(url.toString(), {
            method: req.method ?? 'GET',
            headers: toFetchHeaders(req.headers),
            body,
          })

          const functionModule = await server.ssrLoadModule(functionModulePath)
          const response = await functionModule.onRequest({
            request,
            env: process.env,
          })

          await writeFetchResponseToNode(res, response)
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error in dev bridge.'
          console.error(`[vite] ${url.pathname} bridge failed:`, error)
          if (!res.headersSent) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
          }
          res.end(JSON.stringify({ error: message }))
        }
      })
    },
  }
}

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
      cloudflareFunctionsDevBridge(),
      react(),
      tailwindcss(),
      ...(pwaPlugin ? [pwaPlugin] : []),
    ],
  }
})
