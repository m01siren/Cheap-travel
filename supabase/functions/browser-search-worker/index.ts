import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { runBrowserSearchJob } from '../_shared/browserSearch.ts'

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  try {
    if (req.method !== 'POST') return json(405, { message: 'Method not allowed' })

    const service = createClient(supabaseUrl, serviceRoleKey)
    const { data: jobs, error } = await service
      .from('search_jobs')
      .select('id,query,sources')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(10)

    if (error) return json(400, { message: error.message })
    let processed = 0

    for (const job of jobs || []) {
      try {
        await runBrowserSearchJob(service, job.id, job.query as any, Array.isArray(job.sources) ? job.sources : [])
        processed += 1
      } catch (e) {
        console.error('[browser-search-worker] job failed', job.id, e)
      }
    }

    return json(200, { ok: true, processed })
  } catch (e) {
    return json(500, { message: e instanceof Error ? e.message : String(e) })
  }
})

