import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  handleCorsPreflight,
  internalError,
  isOriginForbidden,
  json,
  jsonCors,
} from '../_shared/httpJson.ts'

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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

    const { user_id, role } = await req.json()
    if (!user_id || typeof user_id !== 'string' || !uuidRe.test(user_id)) {
      return jsonCors(req, 400, { message: 'Invalid user_id format' })
    }

    if (role !== 'admin' && role !== 'user') {
      return jsonCors(req, 400, { message: 'role must be admin or user' })
    }

    const service = createClient(supabaseUrl, serviceRoleKey)

    const { data: callerProfile, error: callerProfileErr } = await service
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (callerProfileErr || !callerProfile || callerProfile.role !== 'admin') {
      return jsonCors(req, 403, { message: 'Forbidden: admin only' })
    }

    const { data: targetProfile, error: targetFindErr } = await service
      .from('profiles')
      .select('id')
      .eq('id', user_id)
      .maybeSingle()
    if (targetFindErr) {
      console.error('[admin-set-role] target find', targetFindErr)
      return jsonCors(req, 400, { message: 'Не удалось найти пользователя' })
    }
    if (!targetProfile) return jsonCors(req, 400, { message: 'Target user profile not found' })

    const { error: targetErr } = await service.from('profiles').update({ role }).eq('id', user_id)
    if (targetErr) {
      console.error('[admin-set-role] update', targetErr)
      return jsonCors(req, 400, { message: 'Не удалось обновить роль' })
    }

    return jsonCors(req, 200, { ok: true })
  } catch (e) {
    return internalError('admin-set-role', e, req)
  }
})
