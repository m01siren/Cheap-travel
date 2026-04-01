import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { runBrowserSearchJob } from '../_shared/browserSearch.ts'
import { handleCorsPreflight, internalError, json, jsonCors } from '../_shared/httpJson.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') return handleCorsPreflight(req)
    if (req.method !== 'POST') return jsonCors(req, 405, { message: 'Method not allowed' })

    const workerSecret = Deno.env.get('BROWSER_SEARCH_WORKER_SECRET')
    if (workerSecret) {
      const h = req.headers.get('x-worker-secret') ?? ''
      if (h !== workerSecret) return json(401, { message: 'Unauthorized' })
    }

    const service = createClient(supabaseUrl, serviceRoleKey)
    const { data: jobs, error } = await service
      .from('search_jobs')
      .select('id,query,sources')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(10)

    if (error) {
      console.error('[browser-search-worker]', error)
      return jsonCors(req, 400, { message: 'Не удалось получить очередь' })
    }
    let processed = 0

    for (const job of jobs || []) {
      try {
        await runBrowserSearchJob(service, job.id, job.query as any, Array.isArray(job.sources) ? job.sources : [])
        processed += 1
      } catch (e) {
        console.error('[browser-search-worker] job failed', job.id, e)
      }
    }

    return jsonCors(req, 200, { ok: true, processed })
  } catch (e) {
    return internalError('browser-search-worker', e, req)
  }
})
