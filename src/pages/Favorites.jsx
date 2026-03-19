import { Link } from 'react-router-dom'
import { RouteCard, useFavorites } from '../components/common.jsx'
import { Button } from '../components/ui.jsx'
import { mockRoutes } from '../data/mockRoutes.js'

export function FavoritesPage() {
  const favorites = useFavorites()
  const routes = favorites.ids
    .map((id) => mockRoutes.find((r) => r.id === id))
    .filter(Boolean)

  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Избранное</h1>
        <p className="text-sm text-white/80">Список хранится в localStorage.</p>
      </div>

      {routes.length === 0 ? (
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
                <Button variant="outline" onClick={() => favorites.remove(r.id)}>
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

