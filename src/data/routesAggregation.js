import { sumDuration, sumPrice } from '../utils/routeUtils.js'

function normalizeMode(mode) {
  const m = String(mode || '').toLowerCase()
  if (m.includes('plane') || m.includes('flight') || m.includes('air')) return 'plane'
  if (m.includes('train') || m.includes('rail')) return 'train'
  if (m.includes('bus')) return 'bus'
  return 'bus'
}

function normalizeSegment(segment) {
  return {
    from: String(segment?.from ?? segment?.origin ?? '').trim(),
    to: String(segment?.to ?? segment?.destination ?? '').trim(),
    mode: normalizeMode(segment?.mode),
    durationMin: Number(segment?.durationMin ?? segment?.duration_min ?? 0) || 0,
    price: Number(segment?.price ?? 0) || 0,
  }
}

export function normalizeExternalRoute(raw, idx = 0) {
  const rawSegments = Array.isArray(raw?.segments) ? raw.segments : []
  const segments = rawSegments.map(normalizeSegment).filter((s) => s.from && s.to)
  if (!segments.length) return null

  const externalId = String(raw?.externalId ?? raw?.id ?? `ext-${idx}`)
  const currency = String(raw?.currency ?? 'RUB').toUpperCase()
  return {
    id: `external:${externalId}`,
    externalId,
    segments,
    title: String(raw?.title ?? `${segments[0].from} → ${segments[segments.length - 1].to}`),
    ownerId: null,
    currency,
    status: 'published',
    provider: String(raw?.provider ?? 'open-source'),
    sourceType: 'live',
  }
}

export function scoreRoute(route) {
  const price = sumPrice(route.segments)
  const duration = sumDuration(route.segments)
  const transfers = Math.max(0, route.segments.length - 1)
  const transferPenalty = transfers * 800
  const durationPenalty = Math.round(duration * 0.8)
  return price + durationPenalty + transferPenalty
}

function routeFingerprint(route) {
  const first = route.segments[0]
  const last = route.segments[route.segments.length - 1]
  return `${first?.from}|${last?.to}|${Math.round(sumPrice(route.segments))}|${route.currency || 'RUB'}`
}

export function mergeAndRankRoutes(dbRoutes, liveRoutes) {
  const byKey = new Map()
  for (const r of [...dbRoutes, ...liveRoutes]) {
    if (!r?.segments?.length) continue
    const key = routeFingerprint(r)
    const current = byKey.get(key)
    const withScore = { ...r, score: scoreRoute(r) }
    if (!current || withScore.score < current.score) byKey.set(key, withScore)
  }

  const result = Array.from(byKey.values())
  result.sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
  return result
}
