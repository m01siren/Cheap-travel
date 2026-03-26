import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  try {
    if (req.method !== 'POST') return json(405, { message: 'Method not allowed' })

    const authHeader = req.headers.get('Authorization') || ''
    if (!authHeader) return json(401, { message: 'Missing Authorization header' })

    const caller = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const {
      data: { user },
      error: userErr,
    } = await caller.auth.getUser()

    if (userErr || !user) return json(401, { message: 'Invalid token' })

    const { user_id, role } = await req.json()
    if (!user_id || typeof user_id !== 'string' || !uuidRe.test(user_id)) {
      return json(400, { message: 'Invalid user_id format' })
    }

    if (role !== 'admin' && role !== 'user') {
      return json(400, { message: 'role must be admin or user' })
    }

    // Service client для изменения данных.
    const service = createClient(supabaseUrl, serviceRoleKey)

    // Проверяем роль вызывающего пользователя.
    const { data: callerProfile, error: callerProfileErr } = await service
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (callerProfileErr || !callerProfile || callerProfile.role !== 'admin') {
      return json(403, { message: 'Forbidden: admin only' })
    }

    const { data: targetProfile, error: targetFindErr } = await service
      .from('profiles')
      .select('id')
      .eq('id', user_id)
      .maybeSingle()
    if (targetFindErr) return json(400, { message: targetFindErr.message })
    if (!targetProfile) return json(400, { message: 'Target user profile not found' })

    // Запись целевого пользователя.
    const { error: targetErr } = await service.from('profiles').update({ role }).eq('id', user_id)
    if (targetErr) return json(400, { message: targetErr.message })

    return json(200, { ok: true })
  } catch (e) {
    return json(500, { message: e instanceof Error ? e.message : String(e) })
  }
})

