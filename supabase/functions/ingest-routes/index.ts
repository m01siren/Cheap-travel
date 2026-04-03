import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { internalError, json } from '../_shared/httpJson.ts'
import { finishRequestLog, logError, logEvent, startRequestLog } from '../_shared/log.ts'

type RawRoute = {
  id?: string
  title?: string
  provider?: string
  currency?: string
  segments?: Array<{
    from?: string
    to?: string
    mode?: string
    durationMin?: number
    price?: number
  }>
}

function normalizeMode(mode?: string) {
  const m = String(mode || '').toLowerCase()
  if (m.includes('plane') || m.includes('flight') || m.includes('air')) return 'plane'
  if (m.includes('train') || m.includes('rail')) return 'train'
  if (m.includes('bus')) return 'bus'
  return 'bus'
}

function normalizeRoute(raw: RawRoute) {
  const segments = (Array.isArray(raw.segments) ? raw.segments : [])
    .map((s) => ({
      from: String(s.from ?? '').trim(),
      to: String(s.to ?? '').trim(),
      mode: normalizeMode(s.mode),
      durationMin: Number(s.durationMin ?? 0) || 0,
      price: Number(s.price ?? 0) || 0,
    }))
    .filter((s) => s.from && s.to)

  if (!segments.length) return null

  const origin = segments[0].from
  const destination = segments[segments.length - 1].to
  const totalPrice = segments.reduce((acc, s) => acc + s.price, 0)
  return {
    title: String(raw.title ?? `${origin} → ${destination}`),
    provider: String(raw.provider ?? 'open-source'),
    currency: String(raw.currency ?? 'RUB').toUpperCase(),
    origin_city: origin,
    destination_city: destination,
    price: totalPrice,
    status: 'published',
    segments,
  }
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const externalRoutesUrl = Deno.env.get('EXTERNAL_ROUTES_URL') || ''

serve(async (req) => {
  try {
    const reqLog = startRequestLog('ingest-routes', req)
    if (req.method !== 'POST') {
      const res = json(405, { message: 'Method not allowed' })
      finishRequestLog(reqLog, res.status)
      return res
    }

    const ingestSecret = Deno.env.get('INGEST_ROUTES_SECRET')
    const provided = req.headers.get('x-ingest-secret') ?? ''
    if (!ingestSecret) {
      logError('ingest-routes', new Error('INGEST_ROUTES_SECRET is not set'), undefined, reqLog.id)
      const res = json(503, { message: 'Сервис не настроен: задайте INGEST_ROUTES_SECRET' })
      finishRequestLog(reqLog, res.status)
      return res
    }
    if (provided !== ingestSecret) {
      return json(401, { message: 'Unauthorized' })
    }

    if (!externalRoutesUrl) {
      const res = json(400, { message: 'EXTERNAL_ROUTES_URL is not configured' })
      finishRequestLog(reqLog, res.status)
      return res
    }

    const service = createClient(supabaseUrl, serviceRoleKey)
    const externalResp = await fetch(externalRoutesUrl)
    if (!externalResp.ok) {
      const res = json(400, { message: 'External source is unavailable' })
      finishRequestLog(reqLog, res.status)
      return res
    }

    const payload = await externalResp.json()
    const rows: RawRoute[] = Array.isArray(payload) ? payload : Array.isArray(payload?.routes) ? payload.routes : []
    const normalized = rows.map(normalizeRoute).filter(Boolean)
    if (!normalized.length) {
      const res = json(400, { message: 'No valid routes from external source' })
      finishRequestLog(reqLog, res.status)
      return res
    }

    let updated = 0
    let inserted = 0
    let priceRows = 0

    for (const route of normalized) {
      const { data: existing, error: findErr } = await service
        .from('routes')
        .select('id')
        .eq('title', route.title)
        .eq('origin_city', route.origin_city)
        .eq('destination_city', route.destination_city)
        .eq('provider', route.provider)
        .maybeSingle()

      if (findErr) {
        logError('ingest-routes', findErr, { stage: 'find_route' }, reqLog.id)
        const res = json(400, { message: 'Ошибка при поиске маршрута' })
        finishRequestLog(reqLog, res.status)
        return res
      }

      let routeId = existing?.id ?? null
      if (routeId) {
        const { error: updErr } = await service
          .from('routes')
          .update({
            price: route.price,
            currency: route.currency,
            segments: route.segments,
            status: 'published',
          })
          .eq('id', routeId)
        if (updErr) {
          logError('ingest-routes', updErr, { stage: 'update_route', route_title: route.title }, reqLog.id)
          const res = json(400, { message: 'Не удалось обновить маршрут' })
          finishRequestLog(reqLog, res.status)
          return res
        }
        updated += 1
      } else {
        const { data: created, error: insErr } = await service
          .from('routes')
          .insert(route)
          .select('id')
          .single()
        if (insErr) {
          logError('ingest-routes', insErr, { stage: 'insert_route', route_title: route.title }, reqLog.id)
          const res = json(400, { message: 'Не удалось добавить маршрут' })
          finishRequestLog(reqLog, res.status)
          return res
        }
        routeId = created.id
        inserted += 1
      }

      const { error: priceErr } = await service.from('price_history').insert({
        route_id: routeId,
        price: route.price,
        currency: route.currency,
        source: route.provider,
      })
      if (priceErr) {
        logError('ingest-routes', priceErr, { stage: 'insert_price_history', route_id: routeId }, reqLog.id)
        const res = json(400, { message: 'Не удалось записать историю цен' })
        finishRequestLog(reqLog, res.status)
        return res
      }
      priceRows += 1
    }

    const resBody = {
      ok: true,
      inserted,
      updated,
      price_rows: priceRows,
      total_external_rows: rows.length,
    }
    logEvent('ingest-routes', 'ingest_completed', resBody, reqLog.id)
    const res = json(200, resBody)
    finishRequestLog(reqLog, res.status)
    return res
  } catch (e) {
    logError('ingest-routes', e, undefined, undefined)
    return internalError('ingest-routes', e, req)
  }
})

