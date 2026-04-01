import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { runBrowserSearchJob } from '../_shared/browserSearch.ts'
import {
  handleCorsPreflight,
  internalError,
  isOriginForbidden,
  json,
  jsonCors,
} from '../_shared/httpJson.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') return handleCorsPreflight(req)
    if (req.method !== 'POST') return jsonCors(req, 405, { message: 'Method not allowed' })
    if (isOriginForbidden(req)) return json(403, { message: 'Доступ с этого источника запрещён' })

    const authHeader = req.headers.get('Authorization') || ''
    if (!authHeader) return jsonCors(req, 401, { message: 'Missing Authorization header' })

    const caller = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const {
      data: { user },
      error: userErr,
    } = await caller.auth.getUser()
    if (userErr || !user) return jsonCors(req, 401, { message: 'Invalid token' })

    const payload = await req.json()
    const from = String(payload?.from || '').trim()
    const to = String(payload?.to || '').trim()
    const dateFrom = String(payload?.dateFrom || '').trim()
    const dateTo = String(payload?.dateTo || '').trim()
    const transport = String(payload?.transport || 'all').trim()
    const sources = Array.isArray(payload?.sources) && payload.sources.length
      ? payload.sources.map((x: unknown) => String(x))
      : ['browser_yandex']

    if (!from || !to || !dateFrom) {
      return jsonCors(req, 400, { message: 'from, to and dateFrom are required' })
    }

    const service = createClient(supabaseUrl, serviceRoleKey)
    const { data: job, error: jobErr } = await service
      .from('search_jobs')
      .insert({
        user_id: user.id,
        status: 'queued',
        query: { from, to, dateFrom, dateTo, transport },
        sources,
      })
      .select('id,status,created_at')
      .single()

    if (jobErr || !job) {
      console.error('[browser-search-create]', jobErr)
      return jsonCors(req, 400, { message: 'Не удалось создать задачу' })
    }

    try {
      await runBrowserSearchJob(service, job.id, { from, to, dateFrom, dateTo, transport }, sources)
    } catch (e) {
      console.error('[browser-search-create] worker inline error', e)
    }

    return jsonCors(req, 200, { job_id: job.id, status: 'queued', created_at: job.created_at })
  } catch (e) {
    return internalError('browser-search-create', e, req)
  }
})
