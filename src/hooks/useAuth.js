import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

function getEmailRedirectTo() {
  const envUrl = import.meta.env.VITE_AUTH_REDIRECT_URL
  if (envUrl) return envUrl
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }
  return undefined
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
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message || 'Ошибка входа')
  }

  async function signUp(email, password) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: getEmailRedirectTo(),
      },
    })
    if (error) throw new Error(error.message || 'Ошибка регистрации')
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw new Error(error.message || 'Ошибка выхода')
  }

  return { user, loading, role, roleLoading, signIn, signUp, signOut }
}
