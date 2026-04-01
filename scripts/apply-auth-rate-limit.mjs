/**
 * Применяет миграцию auth_rate_limit напрямую к Postgres (без Supabase CLI token).
 * Нужен DATABASE_URL из Supabase → Project Settings → Database → Connection string (URI).
 *
 *   set DATABASE_URL=postgresql://postgres:...@...:5432/postgres
 *   node scripts/apply-auth-rate-limit.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const url = process.env.DATABASE_URL
if (!url) {
  console.error('Укажите DATABASE_URL (строка подключения Postgres из Supabase Dashboard).')
  process.exit(1)
}

const sqlPath = path.join(__dirname, '../supabase/migrations/20260401190000_auth_rate_limit.sql')
const sql = fs.readFileSync(sqlPath, 'utf8')

const client = new pg.Client({
  connectionString: url,
  ssl: url.includes('localhost') ? false : { rejectUnauthorized: false },
})
await client.connect()
try {
  await client.query(sql)
  console.log('OK: миграция auth_rate_limit применена.')
} finally {
  await client.end()
}
