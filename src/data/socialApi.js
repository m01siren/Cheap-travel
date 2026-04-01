import { supabase } from '../lib/supabase.js'
import { isUuid } from '../lib/validation.js'

function assertRouteId(routeId) {
  if (!isUuid(String(routeId ?? ''))) {
    throw new Error('Некорректный идентификатор маршрута')
  }
}

function assertNoError(error, fallbackMessage) {
  if (!error) return
  throw new Error(error.message || fallbackMessage)
}

export async function fetchVoteStats(routeId) {
  assertRouteId(routeId)
  const { data, error } = await supabase.from('route_vote_stats').select('*').eq('route_id', routeId).maybeSingle()
  assertNoError(error, 'Не удалось загрузить рейтинг')
  return data || { likes_count: 0, dislikes_count: 0, score: 0 }
}

export async function fetchUserVote(routeId, userId) {
  assertRouteId(routeId)
  if (!userId) return null
  const { data, error } = await supabase
    .from('route_votes')
    .select('vote')
    .eq('route_id', routeId)
    .eq('user_id', userId)
    .maybeSingle()
  assertNoError(error, 'Не удалось загрузить ваш голос')
  return data?.vote ?? null
}

export async function setVote(routeId, userId, vote) {
  assertRouteId(routeId)
  if (!userId) throw new Error('Войдите, чтобы голосовать')
  const { error } = await supabase.from('route_votes').upsert(
    { route_id: routeId, user_id: userId, vote },
    { onConflict: 'user_id,route_id' },
  )
  assertNoError(error, 'Не удалось сохранить голос')
}

export async function removeVote(routeId, userId) {
  assertRouteId(routeId)
  if (!userId) return
  const { error } = await supabase.from('route_votes').delete().eq('route_id', routeId).eq('user_id', userId)
  assertNoError(error, 'Не удалось убрать голос')
}

export async function fetchComments(routeId) {
  assertRouteId(routeId)
  const { data: rows, error } = await supabase
    .from('route_comments')
    .select('id, content, created_at, author_id')
    .eq('route_id', routeId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: true })
  assertNoError(error, 'Не удалось загрузить комментарии')
  if (!rows?.length) return []
  const ids = [...new Set(rows.map((r) => r.author_id))]
  const { data: profiles, error: pErr } = await supabase
    .from('profiles')
    .select('id, display_name')
    .in('id', ids)
  assertNoError(pErr, 'Не удалось загрузить авторов комментариев')
  const nameById = Object.fromEntries((profiles || []).map((p) => [p.id, p.display_name]))
  return rows.map((r) => ({
    ...r,
    authorDisplayName: nameById[r.author_id] || 'Пользователь',
  }))
}

export async function addComment(routeId, authorId, content) {
  assertRouteId(routeId)
  if (!authorId) throw new Error('Войдите, чтобы комментировать')
  const trimmed = String(content || '').trim()
  if (!trimmed) throw new Error('Введите текст комментария')
  const { error } = await supabase.from('route_comments').insert({
    route_id: routeId,
    author_id: authorId,
    content: trimmed,
  })
  assertNoError(error, 'Не удалось отправить комментарий')
}

export async function fetchPriceHistory(routeId, limit = 20) {
  assertRouteId(routeId)
  const { data, error } = await supabase
    .from('price_history')
    .select('*')
    .eq('route_id', routeId)
    .order('captured_at', { ascending: false })
    .limit(limit)
  assertNoError(error, 'Не удалось загрузить историю цен')
  return data || []
}

export async function logSearchHistory({
  userId,
  originCity,
  destinationCity,
  departFrom,
  departTo,
  transport,
  maxPrice,
  filtersJson,
}) {
  if (!userId) return
  const { error } = await supabase.from('search_history').insert({
    user_id: userId,
    origin_city: originCity || null,
    destination_city: destinationCity || null,
    depart_from: departFrom || null,
    depart_to: departTo || null,
    transport: transport && transport !== 'all' ? transport : null,
    max_price: maxPrice != null && maxPrice !== '' ? Number(maxPrice) : null,
    filters: filtersJson ?? {},
  })
  assertNoError(error, 'Не удалось сохранить историю поиска')
}
