import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

export function useAuth() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

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

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message || 'Ошибка входа')
  }

  async function signUp(email, password) {
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) throw new Error(error.message || 'Ошибка регистрации')
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw new Error(error.message || 'Ошибка выхода')
  }

  return { user, loading, signIn, signUp, signOut }
}
