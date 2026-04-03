import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getClientIp } from '../_shared/clientIp.ts'
import { finishRequestLog, logError, logEvent, startRequestLog } from '../_shared/log.ts'
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

const MSG_429 =
  'Слишком много попыток регистрации. Разрешено не более 10 за 15 минут. Подождите и попробуйте снова.'

serve(async (req) => {
  const reqLog = startRequestLog('auth-register', req)
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

  try {
    const ip = getClientIp(req)
    const bucket = `register:${ip}`

    const service = createClient(supabaseUrl, serviceRoleKey)
    const { data: rl, error: rlErr } = await service.rpc('try_auth_rate_limit', { p_bucket: bucket })

    if (rlErr) {
      logError('auth-register', rlErr, { stage: 'rate_limit_rpc' }, reqLog.id)
      const res = jsonCors(req, 500, { message: 'Не удалось проверить лимит запросов' })
      finishRequestLog(reqLog, res.status)
      return res
    }

    const allowed = rl && typeof rl === 'object' && (rl as { allowed?: boolean }).allowed === true
    if (!allowed) {
      const retry = (rl as { retry_after_seconds?: number })?.retry_after_seconds ?? 900
      return jsonCors(req, 429, { message: MSG_429, retry_after_seconds: retry }, {
        'Retry-After': String(retry),
      })
    }

    let body: { email?: string; password?: string; emailRedirectTo?: string }
    try {
      body = await req.json()
    } catch (e) {
      logError('auth-register', e, { stage: 'parse_body' }, reqLog.id)
      const res = jsonCors(req, 400, { message: 'Некорректный JSON' })
      finishRequestLog(reqLog, res.status)
      return res
    }

    const email = String(body?.email ?? '').trim()
    const password = String(body?.password ?? '')
    const emailRedirectTo = body?.emailRedirectTo ? String(body.emailRedirectTo).trim() : undefined

    if (!email || !password) {
      const res = jsonCors(req, 400, { message: 'Укажите email и пароль' })
      finishRequestLog(reqLog, res.status)
      return res
    }

    const qs = new URLSearchParams()
    if (emailRedirectTo) qs.set('redirect_to', emailRedirectTo)
    const query = qs.toString() ? `?${qs.toString()}` : ''

    const authRes = await fetch(`${supabaseUrl}/auth/v1/signup${query}`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
        'X-Supabase-Api-Version': '2024-01-01',
      },
      body: JSON.stringify({ email, password }),
    })

    const authJson = await authRes.json().catch(() => ({}))

    if (!authRes.ok) {
      const msg =
        typeof authJson === 'object' && authJson !== null && 'msg' in authJson
          ? String((authJson as { msg?: string }).msg)
          : typeof authJson === 'object' && authJson !== null && 'message' in authJson
            ? String((authJson as { message?: string }).message)
            : 'Ошибка регистрации'
      const res = jsonCors(req, authRes.status, { message: msg })
      finishRequestLog(reqLog, res.status)
      return res
    }

    logEvent('auth-register', 'user_registered', { user_email: email }, reqLog.id)
    const res = jsonCors(req, 200, authJson)
    finishRequestLog(reqLog, res.status)
    return res
  } catch (e) {
    logError('auth-register', e, undefined, reqLog.id)
    const res = internalError('auth-register', e, req)
    finishRequestLog(reqLog, res.status)
    return res
  }
})
