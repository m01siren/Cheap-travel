import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const supabaseUrl = env.VITE_SUPABASE_URL || ''
  const host = supabaseUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')

  return {
    plugins: [react()],
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
