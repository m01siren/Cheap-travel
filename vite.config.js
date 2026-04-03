import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const supabaseUrl = env.VITE_SUPABASE_URL || ''
  const host = supabaseUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')

  const yandexMetrikaId = (env.VITE_YANDEX_METRIKA_ID || '').trim()

  return {
    plugins: [
      react(),
      {
        name: 'inject-yandex-metrika-meta',
        transformIndexHtml(html) {
          return html.replace(
            /(<meta\s+name="yandex-metrika-counter"\s+content=")[^"]*("\s*\/?>)/,
            `$1${yandexMetrikaId}$2`,
          )
        },
      },
    ],
    server: {
      proxy: host
        ? {
            '/api/auth/login': {
              target: `https://${host}`,
              changeOrigin: true,
              rewrite: () => '/functions/v1/auth-login',
            },
            '/api/auth/register': {
              target: `https://${host}`,
              changeOrigin: true,
              rewrite: () => '/functions/v1/auth-register',
            },
          }
        : {},
    },
  }
})
