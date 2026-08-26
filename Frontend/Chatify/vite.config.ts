import { defineConfig } from 'vitest/config'
import { loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const LOCAL_BACKEND_URL = 'http://localhost:3000'

const normalizeOrigin = (
  value: string | undefined,
  {
    production,
    required,
    label,
  }: { production: boolean; required: boolean; label: string }
) => {
  const candidate = value?.trim() ?? ''

  if (!candidate) {
    if (required) {
      throw new Error(`${label} must be configured for a production build`)
    }
    return null
  }

  let parsed: URL
  try {
    parsed = new URL(candidate)
  } catch {
    throw new Error(`${label} must be an absolute HTTP(S) origin`)
  }

  if (
    !['http:', 'https:'].includes(parsed.protocol)
    || parsed.username
    || parsed.password
    || parsed.search
    || parsed.hash
    || (parsed.pathname && parsed.pathname !== '/')
    || (production && parsed.protocol !== 'https:')
  ) {
    throw new Error(`${label} must be a credential-free ${production ? 'HTTPS' : 'HTTP(S)'} origin`)
  }

  return parsed.origin
}

const toWebSocketOrigin = (origin: string) => {
  const parsed = new URL(origin)
  parsed.protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:'
  return parsed.origin
}

const buildContentSecurityPolicy = ({
  production,
  connectSources,
}: {
  production: boolean
  connectSources: string[]
}) => [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-src 'none'",
  "form-action 'self'",
  `script-src 'self'${production ? '' : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src ${connectSources.join(' ')}`,
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  ...(production ? ['upgrade-insecure-requests'] : []),
].join('; ')

const injectContentSecurityPolicy = (policy: string): Plugin => ({
  name: 'chatify-content-security-policy',
  transformIndexHtml: {
    order: 'pre',
    handler: () => [{
      tag: 'meta',
      attrs: {
        'http-equiv': 'Content-Security-Policy',
        content: policy,
      },
      injectTo: 'head-prepend',
    }],
  },
})

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const production = mode === 'production'
  const sameOriginApi = production && env.VITE_USE_SAME_ORIGIN_API === 'true'
  const backendOrigin = normalizeOrigin(env.VITE_BACKEND_URL, {
    production,
    required: production && !sameOriginApi,
    label: 'VITE_BACKEND_URL',
  }) ?? LOCAL_BACKEND_URL
  const socketOrigin = normalizeOrigin(env.VITE_SOCKET_URL || backendOrigin, {
    production,
    required: production && !sameOriginApi,
    label: 'VITE_SOCKET_URL',
  }) ?? backendOrigin
  const connectSources = new Set(["'self'"])

  if (!sameOriginApi) {
    connectSources.add(backendOrigin)
    connectSources.add(socketOrigin)
    connectSources.add(toWebSocketOrigin(socketOrigin))
  }

  const contentSecurityPolicy = buildContentSecurityPolicy({
    production,
    connectSources: [...connectSources],
  })

  return {
    plugins: [
      injectContentSecurityPolicy(contentSecurityPolicy),
      react(),
      tailwindcss(),
    ],
    build: {
      sourcemap: false,
    },
    server: {
      proxy: {
        '/api': {
          target: backendOrigin,
          changeOrigin: true,
        },
      },
    },
    test: {
      environment: 'jsdom',
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
      setupFiles: './src/test/setup.ts',
    },
  }
})
