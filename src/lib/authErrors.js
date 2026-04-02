function isNetworkLikeMessage(msg) {
  const lower = String(msg || '').toLowerCase()
  return (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('load failed') ||
    lower.includes('network request failed')
  )
}

/** Для ошибок сети — подсказка по CORS/URL; для остальных — текст как есть. */
export function mapAuthNetworkError(err) {
  const raw = String(err?.message ?? err ?? '')
  if (!isNetworkLikeMessage(raw)) return raw || 'Ошибка'
  return (
    'Не удалось связаться с Supabase. Проверьте: ' +
    '1) Supabase → Edge Functions → Secrets: CORS_ALLOWED_ORIGINS включает точный адрес сайта (https://…, без лишнего слэша). ' +
    '2) Supabase → Authentication → URL Configuration: в Redirect URLs добавлен тот же адрес. ' +
    '3) В Amvera: VITE_AUTH_REDIRECT_URL = https://ваш-домен; при необходимости VITE_USE_EDGE_AUTH=false.'
  )
}
