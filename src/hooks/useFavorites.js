import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { useAuth } from './useAuth.js'

export function useFavorites() {
  const { user, loading: authLoading } = useAuth()
  const [ids, setIds] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadFavorites() {
      if (authLoading) return
      if (!user) {
        setIds([])
        setError('')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError('')
        const { data, error: fetchError } = await supabase
          .from('favorites')
          .select('route_id')
          .eq('user_id', user.id)

        if (fetchError) throw fetchError
        if (!cancelled) setIds((data || []).map((row) => String(row.route_id)))
      } catch (e) {
        if (!cancelled) {
          setError(e.message || 'Не удалось загрузить избранное')
          setIds([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadFavorites()
    return () => {
      cancelled = true
    }
  }, [authLoading, user])

  const set = useMemo(() => new Set(ids), [ids])

  function isFavorite(id) {
    return set.has(id)
  }

  async function remove(id) {
    if (!user) throw new Error('Войдите, чтобы управлять избранным')
    const { error: deleteError } = await supabase
      .from('favorites')
      .delete()
      .eq('user_id', user.id)
      .eq('route_id', id)
    if (deleteError) throw new Error(deleteError.message || 'Не удалось удалить из избранного')
    setIds((prev) => prev.filter((x) => x !== id))
  }

  async function toggle(id) {
    if (!user) throw new Error('Войдите, чтобы сохранять маршруты')

    if (set.has(id)) {
      await remove(id)
      return
    }

    const { error: insertError } = await supabase
      .from('favorites')
      .upsert({ user_id: user.id, route_id: id }, { onConflict: 'user_id,route_id', ignoreDuplicates: true })
    if (insertError) throw new Error(insertError.message || 'Не удалось добавить в избранное')
    setIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
  }

  return { ids, isFavorite, remove, toggle, loading, error, user, authLoading }
}
