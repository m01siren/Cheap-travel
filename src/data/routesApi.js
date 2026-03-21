import { supabase } from '../lib/supabase.js'

function normalizeSegments(rawSegments) {
  if (!Array.isArray(rawSegments)) return []
  return rawSegments
    .map((s) => ({
      from: String(s.from ?? ''),
      to: String(s.to ?? ''),
      mode: String(s.mode ?? 'bus'),
      durationMin: Number(s.durationMin ?? s.duration_min ?? 0) || 0,
      price: Number(s.price ?? 0) || 0,
    }))
    .filter((s) => s.from && s.to)
}

function mapRoute(row) {
  const mappedSegments = normalizeSegments(row.segments)
  const segments =
    mappedSegments.length > 0
      ? mappedSegments
      : [
          {
            from: String(row.origin_city ?? ''),
            to: String(row.destination_city ?? ''),
            mode: String(row.transport_mode ?? 'bus'),
            durationMin: Number(row.duration_min ?? 0) || 0,
            price: Number(row.price ?? 0) || 0,
          },
        ].filter((s) => s.from && s.to)

  return {
    id: String(row.id),
    segments,
  }
}

function assertNoError(error, fallbackMessage) {
  if (!error) return
  throw new Error(error.message || fallbackMessage)
}

export async function fetchRoutes() {
  const { data, error } = await supabase.from('routes').select('*')
  assertNoError(error, 'Не удалось загрузить маршруты')
  return (data || []).map(mapRoute)
}

export async function fetchRouteById(id) {
  const { data, error } = await supabase.from('routes').select('*').eq('id', id).maybeSingle()
  assertNoError(error, 'Не удалось загрузить маршрут')
  return data ? mapRoute(data) : null
}

export async function fetchRoutesByIds(ids) {
  if (!ids.length) return []
  const { data, error } = await supabase.from('routes').select('*').in('id', ids)
  assertNoError(error, 'Не удалось загрузить избранные маршруты')
  return (data || []).map(mapRoute)
}
