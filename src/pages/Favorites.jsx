import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { RouteCard } from '../components/common.jsx'
import { useFavorites } from '../hooks/useFavorites.js'
import { Button } from '../components/ui.jsx'
import { fetchRoutesByIds } from '../data/routesApi.js'

export function FavoritesPage() {
  const favorites = useFavorites()
  const [routes, setRoutes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadFavorites() {
      if (favorites.authLoading) return
      if (!favorites.user) {
        setLoading(false)
        setError('')
        setRoutes([])
        return
      }

      try {
        setLoading(true)
        setError('')
        const data = await fetchRoutesByIds(favorites.ids)
        if (!cancelled) setRoutes(data)
      } catch (e) {
        if (!cancelled) setError(e.message || 'Не удалось загрузить избранные маршруты')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadFavorites()
    return () => {
      cancelled = true
    }
  }, [favorites.authLoading, favorites.ids, favorites.user])

  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Избранное</h1>
        <p className="text-sm text-white/80">Список хранится в вашем аккаунте Supabase.</p>
      </div>

      {favorites.authLoading || loading || favorites.loading ? (
        <div className="text-sm text-white/80">Загрузка...</div>
      ) : !favorites.user ? (
        <div className="text-sm text-white/80">Войдите в аккаунт, чтобы увидеть избранные маршруты.</div>
      ) : favorites.error ? (
        <div className="text-sm text-red-200">{favorites.error}</div>
      ) : error ? (
        <div className="text-sm text-red-200">{error}</div>
      ) : routes.length === 0 ? (
        <div className="grid gap-3 rounded-2xl border border-white/25 bg-white/10 p-4 backdrop-blur-md">
          <div className="text-sm text-white/85">
            Пока пусто — сохраните маршрут со страницы деталей.
          </div>
          <Link
            to="/"
            className="inline-flex h-10 w-fit items-center justify-center rounded-full border border-white/25 bg-white/20 px-5 py-2 text-sm font-medium text-white transition-all hover:brightness-95 active:translate-y-px"
          >
            На главную
          </Link>
        </div>
      ) : (
        <div className="grid gap-3">
          {routes.map((r) => (
            <RouteCard
              key={r.id}
              route={r}
              actions={
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      await favorites.remove(r.id)
                    } catch (e) {
                      setError(e.message || 'Не удалось удалить из избранного')
                    }
                  }}
                >
                  Удалить
                </Button>
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}

