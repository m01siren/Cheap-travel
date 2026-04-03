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
import { finishRequestLog, logError, logEvent, startRequestLog } from '../_shared/log.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  try {
    const reqLog = startRequestLog('browser-search-create', req)
    if (req.method === 'OPTIONS') {
      const res = handleCorsPreflight(req)
      finishRequestLog(reqLog, res.status)
      return res
    }
    if (req.method !== 'POST') {
      const res = jsonCors(req, 405, { message: 'Method not allowed' })
      finishRequestLog(reqLog, res.status)
      return res
    }
    if (isOriginForbidden(req)) {
      const res = json(403, { message: 'Доступ с этого источника запрещён' })
      finishRequestLog(reqLog, res.status)
      return res
    }

    const authHeader = req.headers.get('Authorization') || ''
    if (!authHeader) {
      const res = jsonCors(req, 401, { message: 'Missing Authorization header' })
      finishRequestLog(reqLog, res.status)
      return res
    }

    const caller = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const {
      data: { user },
      error: userErr,
    } = await caller.auth.getUser()
    if (userErr || !user) {
      const res = jsonCors(req, 401, { message: 'Invalid token' })
      finishRequestLog(reqLog, res.status)
      return res
    }

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
      const res = jsonCors(req, 400, { message: 'from, to and dateFrom are required' })
      finishRequestLog(reqLog, res.status)
      return res
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
      logError('browser-search-create', jobErr, { stage: 'create_job' }, reqLog.id)
      const res = jsonCors(req, 400, { message: 'Не удалось создать задачу' })
      finishRequestLog(reqLog, res.status)
      return res
    }

    try {
      await runBrowserSearchJob(service, job.id, { from, to, dateFrom, dateTo, transport }, sources)
    } catch (e) {
      logError('browser-search-create', e, { stage: 'run_job_inline', job_id: job.id }, reqLog.id)
    }

    logEvent(
      'browser-search-create',
      'browser_search_started',
      { job_id: job.id, from, to, dateFrom, sources },
      reqLog.id,
    )
    const res = jsonCors(req, 200, { job_id: job.id, status: 'queued', created_at: job.created_at })
    finishRequestLog(reqLog, res.status)
    return res
  } catch (e) {
    logError('browser-search-create', e)
    return internalError('browser-search-create', e, req)
  }
})
