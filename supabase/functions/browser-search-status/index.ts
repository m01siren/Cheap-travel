import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  handleCorsPreflight,
  internalError,
  isOriginForbidden,
  json,
  isUuid,
  jsonCors,
} from '../_shared/httpJson.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') return handleCorsPreflight(req)
    if (isOriginForbidden(req)) return json(403, { message: 'Доступ с этого источника запрещён' })
    if (req.method !== 'GET') return jsonCors(req, 405, { message: 'Method not allowed' })

    const authHeader = req.headers.get('Authorization') || ''
    if (!authHeader) return jsonCors(req, 401, { message: 'Missing Authorization header' })

    const caller = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const {
      data: { user },
      error: userErr,
    } = await caller.auth.getUser()
    if (userErr || !user) return jsonCors(req, 401, { message: 'Invalid token' })

    const url = new URL(req.url)
    const jobId = url.searchParams.get('job_id')
    if (!jobId) return jsonCors(req, 400, { message: 'job_id is required' })
    if (!isUuid(jobId)) return jsonCors(req, 400, { message: 'invalid job_id' })

    const service = createClient(supabaseUrl, serviceRoleKey)
    const { data: job, error } = await service
      .from('search_jobs')
      .select('id,user_id,status,created_at,started_at,finished_at,error_message')
      .eq('id', jobId)
      .maybeSingle()

    if (error) {
      console.error('[browser-search-status]', error)
      return jsonCors(req, 400, { message: 'Не удалось загрузить задачу' })
    }
    if (!job) return jsonCors(req, 404, { message: 'Job not found' })
    if (job.user_id !== user.id) return jsonCors(req, 403, { message: 'Forbidden' })

    return jsonCors(req, 200, {
      job_id: job.id,
      status: job.status,
      created_at: job.created_at,
      started_at: job.started_at,
      finished_at: job.finished_at,
      error_message: job.error_message,
    })
  } catch (e) {
    return internalError('browser-search-status', e, req)
  }
})
