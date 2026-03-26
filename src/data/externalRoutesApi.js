import { normalizeExternalRoute } from './routesAggregation.js'

const EXTERNAL_ROUTES_URL = import.meta.env.VITE_EXTERNAL_ROUTES_URL || ''
const ENABLE_OSM_SOURCES = String(import.meta.env.VITE_ENABLE_OSM_SOURCES ?? 'true') !== 'false'
export const hasExternalRoutesSource = Boolean(EXTERNAL_ROUTES_URL) || ENABLE_OSM_SOURCES

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

const HUBS = [
  { name: 'Краснодар', lat: 45.0355, lon: 38.9753 },
  { name: 'Минеральные Воды', lat: 44.2087, lon: 43.1383 },
  { name: 'Тбилиси', lat: 41.7151, lon: 44.8271 },
]

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
  const payload = await fetchJsonWithTimeout(url.toString(), 7000)
  const first = Array.isArray(payload) ? payload[0] : null
  if (!first?.lat || !first?.lon) return null
  return { lat: Number(first.lat), lon: Number(first.lon), display: city }
}

async function fetchOsrmLeg(from, to) {
  const url = new URL(
    `https://router.project-osrm.org/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}`,
  )
  url.searchParams.set('overview', 'false')
  url.searchParams.set('alternatives', 'false')
  const payload = await fetchJsonWithTimeout(url.toString(), 8000)
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
  const payload = await fetchJsonWithTimeout(url.toString(), 10000)
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

export async function fetchExternalRoutes(query) {
  const [custom, osm] = await Promise.allSettled([fetchCustomExternalRoutes(query), fetchOsmRoutes(query)])
  const customRoutes = custom.status === 'fulfilled' ? custom.value : []
  const osmRoutes = osm.status === 'fulfilled' ? osm.value : []
  const normalized = [...customRoutes, ...osmRoutes]

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
