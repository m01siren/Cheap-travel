import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { getEnv } from '../lib/env.js'

/** В dev — прокси Vite на Edge Function; в prod — прямой URL functions/v1. */
function authRequestUrl(kind) {
  if (import.meta.env.DEV) {
    return kind === 'login' ? '/api/auth/login' : '/api/auth/register'
  }
  const base = getEnv('VITE_SUPABASE_URL')?.replace(/\/$/, '') || ''
  const name = kind === 'login' ? 'auth-login' : 'auth-register'
  return `${base}/functions/v1/${name}`
}

function getEmailRedirectTo() {
  const envUrl = getEnv('VITE_AUTH_REDIRECT_URL')
  if (envUrl) return envUrl
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }
  return undefined
}

function isNetworkLikeError(error) {
  const message = String(error?.message || '').toLowerCase()
  return message.includes('failed to fetch') || message.includes('networkerror') || message.includes('fetch')
}

export function useAuth() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState(null)
  const [roleLoading, setRoleLoading] = useState(false)

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setUser(data.session?.user ?? null)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadRole() {
      if (!user?.id) {
        setRole(null)
        return
      }

      setRoleLoading(true)
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle()

        if (error) throw error
        if (!cancelled) setRole(data?.role ?? 'user')
      } catch {
        if (!cancelled) setRole('user')
      } finally {
        if (!cancelled) setRoleLoading(false)
      }
    }

    loadRole()
    return () => {
      cancelled = true
    }
  }, [user?.id])

  async function signIn(email, password) {
    try {
      const anon = getEnv('VITE_SUPABASE_ANON_KEY')
      const res = await fetch(authRequestUrl('login'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${anon}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })
      const payload = await res.json().catch(() => ({}))
      if (res.status === 429) {
        throw new Error(
          payload.message ||
            'Слишком много попыток входа. Разрешено не более 10 за 15 минут. Подождите и попробуйте снова.',
        )
      }
      if (!res.ok) {
        throw new Error(payload.message || payload.msg || 'Ошибка входа')
      }
      const access_token = payload.access_token
      const refresh_token = payload.refresh_token
      if (!access_token || !refresh_token) {
        throw new Error('Некорректный ответ сервера')
      }
      const { error } = await supabase.auth.setSession({ access_token, refresh_token })
      if (error) throw new Error(error.message || 'Ошибка входа')
    } catch (e) {
      // Фолбэк для деплоя, где Edge auth-proxy недоступен по сети/CORS:
      // пробуем стандартный Supabase Auth.
      if (!isNetworkLikeError(e)) throw e
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw new Error(error.message || 'Ошибка входа')
    }
  }

  async function signUp(email, password) {
    try {
      const anon = getEnv('VITE_SUPABASE_ANON_KEY')
      const res = await fetch(authRequestUrl('register'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${anon}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          emailRedirectTo: getEmailRedirectTo(),
        }),
      })
      const payload = await res.json().catch(() => ({}))
      if (res.status === 429) {
        throw new Error(
          payload.message ||
            'Слишком много попыток регистрации. Разрешено не более 10 за 15 минут. Подождите и попробуйте снова.',
        )
      }
      if (!res.ok) {
        throw new Error(payload.message || payload.msg || 'Ошибка регистрации')
      }
      if (payload.access_token && payload.refresh_token) {
        const { error } = await supabase.auth.setSession({
          access_token: payload.access_token,
          refresh_token: payload.refresh_token,
        })
        if (error) throw new Error(error.message || 'Ошибка регистрации')
      }
    } catch (e) {
      if (!isNetworkLikeError(e)) throw e
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: getEmailRedirectTo() },
      })
      if (error) throw new Error(error.message || 'Ошибка регистрации')
    }
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw new Error(error.message || 'Ошибка выхода')
  }

  return { user, loading, role, roleLoading, signIn, signUp, signOut }
}
