import { supabase } from '../lib/supabase.js'
import { getEnv } from '../lib/env.js'

async function getAccessToken() {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Войдите в аккаунт для browser-поиска')
  return session.access_token
}

async function invokeGet(functionName, query) {
  const token = await getAccessToken()
  const base = `${getEnv('VITE_SUPABASE_URL')}/functions/v1/${functionName}`
  const url = new URL(base)
  Object.entries(query || {}).forEach(([k, v]) => {
    if (v != null && v !== '') url.searchParams.set(k, String(v))
  })
  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload?.message || 'Ошибка browser-поиска')
  return payload
}

export async function createBrowserSearchJob(query) {
  const token = await getAccessToken()
  const base = `${getEnv('VITE_SUPABASE_URL')}/functions/v1/browser-search-create`
  const response = await fetch(base, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(query),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload?.message || 'Не удалось создать browser-задачу')
  return payload
}

export function getBrowserSearchStatus(jobId) {
  return invokeGet('browser-search-status', { job_id: jobId })
}

export function getBrowserSearchResults(jobId) {
  return invokeGet('browser-search-results', { job_id: jobId })
}

