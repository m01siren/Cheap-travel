import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  try {
    if (req.method !== 'GET') return json(405, { message: 'Method not allowed' })
    const authHeader = req.headers.get('Authorization') || ''
    if (!authHeader) return json(401, { message: 'Missing Authorization header' })

    const caller = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const {
      data: { user },
      error: userErr,
    } = await caller.auth.getUser()
    if (userErr || !user) return json(401, { message: 'Invalid token' })

    const url = new URL(req.url)
    const jobId = url.searchParams.get('job_id')
    if (!jobId) return json(400, { message: 'job_id is required' })

    const service = createClient(supabaseUrl, serviceRoleKey)
    const { data: job, error } = await service
      .from('search_jobs')
      .select('id,user_id,status,created_at,started_at,finished_at,error_message')
      .eq('id', jobId)
      .maybeSingle()

    if (error) return json(400, { message: error.message })
    if (!job) return json(404, { message: 'Job not found' })
    if (job.user_id !== user.id) return json(403, { message: 'Forbidden' })

    return json(200, {
      job_id: job.id,
      status: job.status,
      created_at: job.created_at,
      started_at: job.started_at,
      finished_at: job.finished_at,
      error_message: job.error_message,
    })
  } catch (e) {
    return json(500, { message: e instanceof Error ? e.message : String(e) })
  }
})

