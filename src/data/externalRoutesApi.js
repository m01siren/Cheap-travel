import { normalizeExternalRoute } from './routesAggregation.js'
import { logProviderError, logProviderRequest, logProviderResponse } from './providerLogger.js'

import { getEnv } from '../lib/env.js'

const EXTERNAL_ROUTES_URL = getEnv('VITE_EXTERNAL_ROUTES_URL') || ''
const ENABLE_OSM_SOURCES = String(getEnv('VITE_ENABLE_OSM_SOURCES', 'true')) !== 'false'
const ENABLE_YANDEX_RASP = String(getEnv('VITE_ENABLE_YANDEX_RASP', 'true')) !== 'false'
const ENABLE_AVIATIONSTACK = String(getEnv('VITE_ENABLE_AVIATIONSTACK', 'true')) !== 'false'
const ENABLE_CBR_RATES = String(getEnv('VITE_ENABLE_CBR_RATES', 'true')) !== 'false'

const YANDEX_RASP_API_KEY = getEnv('VITE_YANDEX_RASP_API_KEY') || ''
const AVIATIONSTACK_API_KEY = getEnv('VITE_AVIATIONSTACK_API_KEY') || ''

export const hasExternalRoutesSource =
  Boolean(EXTERNAL_ROUTES_URL) || ENABLE_OSM_SOURCES || ENABLE_YANDEX_RASP || ENABLE_AVIATIONSTACK

const CITY_COORDS = {
  москва: [55.7558, 37.6173],
  феодосия: [45.0319, 35.3824],
  гюмри: [40.7894, 43.8475],
  тбилиси: [41.7151, 44.8271],
  краснодар: [45.0355, 38.9753],
  'минеральные воды': [44.2087, 43.1383],
  ростов: [47.2357, 39.7015],
  'ростов-на-дону': [47.2357, 39.7015],
  'санкт-петербург': [59.9343, 30.3351],
  варшава: [52.2297, 21.0122],
  ереван: [40.1772, 44.5035],
}

const CITY_IATA = {
  москва: 'MOW',
  'санкт-петербург': 'LED',
  тбилиси: 'TBS',
  ереван: 'EVN',
  варшава: 'WAW',
}

const HUBS = [
  { name: 'Краснодар', lat: 45.0355, lon: 38.9753 },
  { name: 'Минеральные Воды', lat: 44.2087, lon: 43.1383 },
  { name: 'Тбилиси', lat: 41.7151, lon: 44.8271 },
]

const CBR_CODE_BY_CURRENCY = {
  RUB: null,
  USD: 'USD',
  EUR: 'EUR',
  GBP: 'GBP',
  KZT: 'KZT',
  BYN: 'BYN',
  CNY: 'CNY',
  TRY: 'TRY',
  GEL: 'GEL',
  AMD: 'AMD',
}

function includesText(haystack, needle) {
  const h = String(haystack || '').toLowerCase()
  const n = String(needle || '').toLowerCase().trim()
  if (!n) return true
  return h.includes(n)
}

async function fetchJsonWithTimeout(url, timeoutMs = 8000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return response.json()
  } finally {
    clearTimeout(timer)
  }
}

async function safeProviderCall(provider, endpoint, fn, payload) {
  try {
    logProviderRequest(provider, endpoint, payload)
    const result = await fn()
    logProviderResponse(provider, endpoint, {
      ok: true,
      items: Array.isArray(result) ? result.length : undefined,
    })
    return result
  } catch (error) {
    logProviderError(provider, endpoint, error, payload)
    return []
  }
}

async function geocodeCity(city) {
  const normalized = String(city || '').trim().toLowerCase()
  if (!normalized) return null
  if (CITY_COORDS[normalized]) {
    const [lat, lon] = CITY_COORDS[normalized]
    return { lat, lon, display: city }
  }

  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('limit', '1')
  url.searchParams.set('q', city)
  const payload = await safeProviderCall(
    'nominatim',
    '/search',
    () => fetchJsonWithTimeout(url.toString(), 7000),
    { q: city },
  )
  const first = Array.isArray(payload) ? payload[0] : null
  if (!first?.lat || !first?.lon) return null
  return { lat: Number(first.lat), lon: Number(first.lon), display: city }
}

async function resolveYandexSettlementCode(city) {
  const point = await geocodeCity(city)
  if (!point) return null
  const url = new URL('https://api.rasp.yandex.net/v3.0/nearest_settlement/')
  url.searchParams.set('apikey', YANDEX_RASP_API_KEY)
  url.searchParams.set('lat', String(point.lat))
  url.searchParams.set('lng', String(point.lon))
  url.searchParams.set('distance', '50')

  const payload = await safeProviderCall(
    'yandex_rasp',
    '/v3.0/nearest_settlement',
    () => fetchJsonWithTimeout(url.toString(), 9000),
    { city, lat: point.lat, lon: point.lon },
  )
  return typeof payload?.code === 'string' ? payload.code : null
}

async function fetchOsrmLeg(from, to) {
  const url = new URL(
    `https://router.project-osrm.org/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}`,
  )
  url.searchParams.set('overview', 'false')
  url.searchParams.set('alternatives', 'false')
  const payload = await safeProviderCall(
    'osrm',
    '/route/v1/driving',
    () => fetchJsonWithTimeout(url.toString(), 8000),
    { from, to },
  )
  const route = payload?.routes?.[0]
  if (!route) return null
  const distanceKm = (Number(route.distance) || 0) / 1000
  const durationMin = Math.max(30, Math.round((Number(route.duration) || 0) / 60))
  return { distanceKm, durationMin }
}

async function fetchCustomExternalRoutes(query) {
  if (!EXTERNAL_ROUTES_URL) return []
  const url = new URL(EXTERNAL_ROUTES_URL)
  if (query?.from) url.searchParams.set('from', query.from)
  if (query?.to) url.searchParams.set('to', query.to)
  if (query?.transport && query.transport !== 'all') url.searchParams.set('transport', query.transport)
  const payload = await safeProviderCall(
    'custom',
    EXTERNAL_ROUTES_URL,
    () => fetchJsonWithTimeout(url.toString(), 10000),
    query,
  )
  const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.routes) ? payload.routes : []
  return rows.map((r, idx) => normalizeExternalRoute(r, idx)).filter(Boolean)
}

function buildDirectRoute(fromName, toName, leg) {
  const price = Math.max(900, Math.round(leg.distanceKm * 11))
  return normalizeExternalRoute(
    {
      id: `osrm-direct-${fromName}-${toName}`,
      title: `${fromName} → ${toName} (open route)`,
      provider: 'osrm',
      currency: 'RUB',
      segments: [{ from: fromName, to: toName, mode: 'bus', durationMin: leg.durationMin, price }],
    },
    0,
  )
}

function buildViaHubRoute(fromName, toName, hubName, leg1, leg2) {
  const price1 = Math.max(700, Math.round(leg1.distanceKm * 10))
  const price2 = Math.max(700, Math.round(leg2.distanceKm * 10))
  return normalizeExternalRoute(
    {
      id: `osrm-via-${fromName}-${hubName}-${toName}`,
      title: `${fromName} → ${hubName} → ${toName} (open route)`,
      provider: 'osrm',
      currency: 'RUB',
      segments: [
        { from: fromName, to: hubName, mode: 'bus', durationMin: leg1.durationMin, price: price1 },
        { from: hubName, to: toName, mode: 'bus', durationMin: leg2.durationMin, price: price2 },
      ],
    },
    0,
  )
}

async function fetchOsmRoutes(query) {
  if (!ENABLE_OSM_SOURCES) return []
  if (!query?.from || !query?.to) return []

  const from = await geocodeCity(query.from)
  const to = await geocodeCity(query.to)
  if (!from || !to) return []

  const result = []
  const direct = await fetchOsrmLeg(from, to)
  if (direct) {
    const route = buildDirectRoute(query.from, query.to, direct)
    if (route) result.push(route)
  }

  for (const hub of HUBS) {
    const leg1 = await fetchOsrmLeg(from, hub)
    const leg2 = await fetchOsrmLeg(hub, to)
    if (!leg1 || !leg2) continue
    const route = buildViaHubRoute(query.from, query.to, hub.name, leg1, leg2)
    if (route) result.push(route)
  }

  return result
}

function cityToIata(city) {
  return CITY_IATA[String(city || '').trim().toLowerCase()] || null
}

async function fetchAviationstackRoutes(query) {
  if (!ENABLE_AVIATIONSTACK || !AVIATIONSTACK_API_KEY) return []
  if (!query?.from || !query?.to) return []
  const dep = cityToIata(query.from)
  const arr = cityToIata(query.to)
  if (!dep || !arr) return []

  const url = new URL('http://api.aviationstack.com/v1/flights')
  url.searchParams.set('access_key', AVIATIONSTACK_API_KEY)
  url.searchParams.set('dep_iata', dep)
  url.searchParams.set('arr_iata', arr)
  if (query?.dateFrom) url.searchParams.set('flight_date', query.dateFrom)
  url.searchParams.set('limit', '8')

  const payload = await safeProviderCall(
    'aviationstack',
    '/v1/flights',
    () => fetchJsonWithTimeout(url.toString(), 9000),
    { dep, arr, date: query?.dateFrom || null },
  )

  const flights = Array.isArray(payload?.data) ? payload.data : []
  return flights
    .map((f, idx) => {
      const depTime = f?.departure?.scheduled
      const arrTime = f?.arrival?.scheduled
      const durationMin =
        depTime && arrTime
          ? Math.max(30, Math.round((new Date(arrTime).getTime() - new Date(depTime).getTime()) / 60000))
          : 180
      // Free plan обычно без цен; используем conservative estimate.
      const estimatedPrice = 9800 + idx * 700
      return normalizeExternalRoute({
        id: `avi-${dep}-${arr}-${f?.flight?.iata ?? idx}`,
        title: `${query.from} → ${query.to} (Aviationstack)`,
        provider: 'aviationstack',
        currency: 'RUB',
        segments: [
          {
            from: query.from,
            to: query.to,
            mode: 'plane',
            durationMin,
            price: estimatedPrice,
          },
        ],
      })
    })
    .filter(Boolean)
}

async function fetchYandexRaspRoutes(query) {
  if (!ENABLE_YANDEX_RASP || !YANDEX_RASP_API_KEY) return []
  if (!query?.from || !query?.to || !query?.dateFrom) return []

  const [fromCode, toCode] = await Promise.all([
    resolveYandexSettlementCode(query.from),
    resolveYandexSettlementCode(query.to),
  ])
  if (!fromCode || !toCode) return []

  const url = new URL('https://api.rasp.yandex.net/v3.0/search/')
  url.searchParams.set('apikey', YANDEX_RASP_API_KEY)
  url.searchParams.set('from', fromCode)
  url.searchParams.set('to', toCode)
  url.searchParams.set('date', query.dateFrom)
  url.searchParams.set('transfers', 'true')

  const payload = await safeProviderCall(
    'yandex_rasp',
    '/v3.0/search',
    () => fetchJsonWithTimeout(url.toString(), 9000),
    { ...query, fromCode, toCode },
  )

  const segments = Array.isArray(payload?.segments) ? payload.segments : []
  return segments
    .map((segment, idx) => {
      const modeRaw = String(segment?.thread?.transport_type || '').toLowerCase()
      const mode =
        modeRaw.includes('plane') || modeRaw.includes('avia')
          ? 'plane'
          : modeRaw.includes('train') || modeRaw.includes('suburban')
            ? 'train'
            : 'bus'
      const fromName = segment?.from?.title || query.from
      const toName = segment?.to?.title || query.to
      const dep = segment?.departure
      const arr = segment?.arrival
      const durationMin =
        dep && arr ? Math.max(30, Math.round((new Date(arr).getTime() - new Date(dep).getTime()) / 60000)) : 240
      const exactPrice = Number(segment?.tickets_info?.places?.[0]?.price?.whole) || null
      const estimatedPrice = mode === 'plane' ? 9300 : mode === 'train' ? 4200 : 2500
      return normalizeExternalRoute({
        id: `yandex-rasp-${idx}-${fromName}-${toName}`,
        title: `${fromName} → ${toName} (Яндекс Расписания)`,
        provider: 'yandex_rasp',
        currency: 'RUB',
        segments: [
          {
            from: fromName,
            to: toName,
            mode,
            durationMin,
            price: exactPrice ?? estimatedPrice,
          },
        ],
      })
    })
    .filter(Boolean)
}

async function fetchRubRates() {
  if (!ENABLE_CBR_RATES) return { USD: 1, EUR: 1 }
  const url = 'https://www.cbr-xml-daily.ru/daily_json.js'
  const payload = await safeProviderCall('cbr', '/daily_json.js', () => fetchJsonWithTimeout(url, 7000), null)
  const valute = payload?.Valute || {}
  return Object.fromEntries(
    Object.entries(CBR_CODE_BY_CURRENCY)
      .filter(([, code]) => code)
      .map(([cur, code]) => {
        const entry = valute[code]
        const value = Number(entry?.Value) || 0
        const nominal = Number(entry?.Nominal) || 1
        return [cur, value > 0 ? value / nominal : 0]
      }),
  )
}

function normalizeToRubPrice(routes, rates) {
  return routes.map((route) => {
    const cur = String(route.currency || 'RUB').toUpperCase()
    const rate = cur === 'RUB' ? 1 : Number(rates[cur] || 0)
    if (!rate || rate <= 0) return route
    const segments = route.segments.map((s) => ({
      ...s,
      price: Math.round(Number(s.price || 0) * rate),
    }))
    return { ...route, segments, currency: 'RUB' }
  })
}

export async function fetchExternalRoutes(query) {
  const [custom, osm, yandex, aviation, rates] = await Promise.allSettled([
    fetchCustomExternalRoutes(query),
    fetchOsmRoutes(query),
    fetchYandexRaspRoutes(query),
    fetchAviationstackRoutes(query),
    fetchRubRates(),
  ])
  const customRoutes = custom.status === 'fulfilled' ? custom.value : []
  const osmRoutes = osm.status === 'fulfilled' ? osm.value : []
  const yandexRoutes = yandex.status === 'fulfilled' ? yandex.value : []
  const aviationRoutes = aviation.status === 'fulfilled' ? aviation.value : []
  const rateMap = rates.status === 'fulfilled' ? rates.value : {}
  const normalized = normalizeToRubPrice([...customRoutes, ...osmRoutes, ...yandexRoutes, ...aviationRoutes], rateMap)

  // Дополнительный фильтр на клиенте, если источник не поддерживает query.
  return normalized.filter((route) => {
    const first = route.segments[0]
    const last = route.segments[route.segments.length - 1]
    const byFrom = includesText(first?.from, query?.from)
    const byTo = includesText(last?.to, query?.to)
    const byTransport =
      !query?.transport || query.transport === 'all'
        ? true
        : route.segments.some((s) => s.mode === query.transport)
    return byFrom && byTo && byTransport
  })
}
