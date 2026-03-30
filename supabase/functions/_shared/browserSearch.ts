import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

type SearchQuery = {
  from: string
  to: string
  dateFrom: string
  dateTo?: string
  transport?: string
}

const CITY_COORDS: Record<string, [number, number]> = {
  москва: [55.7558, 37.6173],
  феодосия: [45.0319, 35.3824],
  гюмри: [40.7894, 43.8475],
  'санкт-петербург': [59.9343, 30.3351],
  варшава: [52.2297, 21.0122],
}

function includesText(haystack: string, needle: string) {
  const h = String(haystack || '').toLowerCase()
  const n = String(needle || '').toLowerCase().trim()
  if (!n) return true
  return h.includes(n)
}

async function fetchJson(url: string, timeoutMs = 9000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return await response.json()
  } finally {
    clearTimeout(timer)
  }
}

async function geocode(city: string) {
  const normalized = city.trim().toLowerCase()
  if (CITY_COORDS[normalized]) {
    const [lat, lon] = CITY_COORDS[normalized]
    return { lat, lon }
  }
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('limit', '1')
  url.searchParams.set('q', city)
  const payload = await fetchJson(url.toString(), 7000)
  const first = Array.isArray(payload) ? payload[0] : null
  if (!first?.lat || !first?.lon) return null
  return { lat: Number(first.lat), lon: Number(first.lon) }
}

async function resolveYandexCode(yandexKey: string, city: string) {
  const point = await geocode(city)
  if (!point) return null
  const url = new URL('https://api.rasp.yandex.net/v3.0/nearest_settlement/')
  url.searchParams.set('apikey', yandexKey)
  url.searchParams.set('lat', String(point.lat))
  url.searchParams.set('lng', String(point.lon))
  url.searchParams.set('distance', '50')
  const payload = await fetchJson(url.toString())
  return typeof payload?.code === 'string' ? payload.code : null
}

function scoreFromSegments(segments: Array<{ durationMin: number; price: number }>) {
  const price = segments.reduce((acc, s) => acc + (Number(s.price) || 0), 0)
  const duration = segments.reduce((acc, s) => acc + (Number(s.durationMin) || 0), 0)
  const transfers = Math.max(0, segments.length - 1)
  return price + Math.round(duration * 0.8) + transfers * 800
}

function toRouteJson(routeId: string, title: string, provider: string, segments: any[]) {
  return {
    id: routeId,
    title,
    ownerId: null,
    currency: 'RUB',
    status: 'published',
    provider,
    sourceType: 'browser',
    segments,
  }
}

export async function runBrowserSearchJob(
  service: ReturnType<typeof createClient>,
  jobId: string,
  query: SearchQuery,
  sources: string[],
) {
  const yandexKey = Deno.env.get('YANDEX_RASP_API_KEY') || ''
  const results: Array<any> = []
  const warnings: string[] = []

  await service
    .from('search_jobs')
    .update({ status: 'running', started_at: new Date().toISOString(), error_message: null })
    .eq('id', jobId)

  try {
    if (sources.includes('browser_yandex') && yandexKey && query.from && query.to && query.dateFrom) {
      try {
        const [fromCode, toCode] = await Promise.all([
          resolveYandexCode(yandexKey, query.from),
          resolveYandexCode(yandexKey, query.to),
        ])
        if (fromCode && toCode) {
          const url = new URL('https://api.rasp.yandex.net/v3.0/search/')
          url.searchParams.set('apikey', yandexKey)
          url.searchParams.set('from', fromCode)
          url.searchParams.set('to', toCode)
          url.searchParams.set('date', query.dateFrom)
          url.searchParams.set('transfers', 'true')
          const payload = await fetchJson(url.toString(), 9000)
          const segments = Array.isArray(payload?.segments) ? payload.segments : []
          for (let idx = 0; idx < segments.length; idx += 1) {
            const s = segments[idx]
            const modeRaw = String(s?.thread?.transport_type || '').toLowerCase()
            const mode = modeRaw.includes('plane') || modeRaw.includes('avia') ? 'plane' : modeRaw.includes('train') ? 'train' : 'bus'
            const dep = s?.departure
            const arr = s?.arrival
            const durationMin =
              dep && arr ? Math.max(30, Math.round((new Date(arr).getTime() - new Date(dep).getTime()) / 60000)) : 240
            const exactPrice = Number(s?.tickets_info?.places?.[0]?.price?.whole) || null
            const estimated = mode === 'plane' ? 9000 : mode === 'train' ? 4200 : 2600
            const routeId = `browser:yandex:${jobId}:${idx}`
            const legs = [
              {
                from: s?.from?.title || query.from,
                to: s?.to?.title || query.to,
                mode,
                durationMin,
                price: exactPrice ?? estimated,
              },
            ]
            results.push({
              job_id: jobId,
              route_id: routeId,
              provider: 'browser_yandex',
              price: legs.reduce((acc, l) => acc + Number(l.price || 0), 0),
              currency: 'RUB',
              price_type: exactPrice ? 'exact' : 'estimated',
              score: scoreFromSegments(legs),
              route: toRouteJson(routeId, `${query.from} → ${query.to} (browser)`, 'browser_yandex', legs),
              fetched_at: new Date().toISOString(),
              expires_at: new Date(Date.now() + 1000 * 60 * 60 * 6).toISOString(),
            })
          }
        } else {
          warnings.push('Не удалось определить коды населённых пунктов для Яндекс Расписаний')
        }
      } catch (e) {
        warnings.push(`browser_yandex: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    // Fallback на локальные маршруты, если внешние не дали результат.
    if (!results.length) {
      const { data: dbRoutes, error } = await service.from('routes').select('*').eq('status', 'published').limit(50)
      if (error) throw error
      const filtered = (dbRoutes || []).filter((r: any) => {
        const from = String(r.origin_city || '')
        const to = String(r.destination_city || '')
        return includesText(from, query.from) && includesText(to, query.to)
      })

      filtered.forEach((r: any, idx: number) => {
        const segments = Array.isArray(r.segments) && r.segments.length
          ? r.segments
          : [{ from: r.origin_city, to: r.destination_city, mode: 'bus', durationMin: 180, price: Number(r.price || 0) }]
        const routeId = `browser:db:${jobId}:${idx}`
        results.push({
          job_id: jobId,
          route_id: routeId,
          provider: 'browser_db_fallback',
          price: Number(r.price || 0),
          currency: String(r.currency || 'RUB'),
          price_type: 'exact',
          score: scoreFromSegments(segments),
          route: toRouteJson(routeId, String(r.title || `${r.origin_city} → ${r.destination_city}`), 'browser_db_fallback', segments),
          fetched_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 1000 * 60 * 30).toISOString(),
        })
      })
    }

    await service.from('search_results_cache').delete().eq('job_id', jobId)
    if (results.length) {
      const { error: insErr } = await service.from('search_results_cache').insert(results)
      if (insErr) throw insErr
    }

    await service
      .from('search_jobs')
      .update({
        status: 'done',
        finished_at: new Date().toISOString(),
        error_message: warnings.length ? warnings.join(' | ') : null,
      })
      .eq('id', jobId)
  } catch (error) {
    await service
      .from('search_jobs')
      .update({
        status: 'error',
        finished_at: new Date().toISOString(),
        error_message: error instanceof Error ? error.message : String(error),
      })
      .eq('id', jobId)
    throw error
  }
}

