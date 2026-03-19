import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Card, CardContent, CardHeader, Badge } from '../components/ui.jsx'
import { useFavorites } from '../components/common.jsx'
import { mockRoutes, modeLabel, routePathText, sumDuration, sumPrice } from '../data/mockRoutes.js'

export function RouteDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const favorites = useFavorites()
  const [loading, setLoading] = useState(false)

  const route = useMemo(() => mockRoutes.find((r) => r.id === id) || null, [id])

  if (!route) {
    return (
      <div className="grid gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Маршрут не найден</h1>
        <Button variant="outline" onClick={() => navigate(-1)}>
          Назад
        </Button>
      </div>
    )
  }

  const price = sumPrice(route.segments)
  const duration = sumDuration(route.segments)
  const transfers = Math.max(0, route.segments.length - 1)
  const path = routePathText(route.segments)
  const isFav = favorites.isFavorite(route.id)

  function onSave() {
    // Имитация небольшого "запроса", чтобы показать Loading-состояние.
    setLoading(true)
    setTimeout(() => {
      favorites.toggle(route.id)
      setLoading(false)
    }, 200)
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-white">Маршрут</h1>
          <p className="text-sm text-white/80">{path}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{price.toLocaleString()} ₽</Badge>
          <Badge>{Math.round(duration / 60)} ч</Badge>
          <Badge>{transfers === 0 ? 'Без пересадок' : `Пересадки: ${transfers}`}</Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="text-sm font-semibold text-white/95">Сегменты</div>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-3">
            {route.segments.map((s, idx) => (
              <div key={`${s.from}-${s.to}-${idx}`} className="grid gap-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium text-white">
                    {idx + 1}. {s.from} → {s.to}
                  </div>
                  <Badge>{modeLabel(s.mode)}</Badge>
                </div>

                {/* "Таймлайн" без графики: просто вертикальные блоки */}
                <div className="rounded-md border border-white/25 bg-white/10 p-3 text-sm text-white/80">
                  <div className="flex flex-wrap items-center gap-3">
                    <span>
                      <span className="text-white/95">Время:</span> {Math.round(s.durationMin / 60)} ч
                    </span>
                    <span>
                      <span className="text-white/95">Цена:</span> {s.price.toLocaleString()} ₽
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={onSave} disabled={loading}>
          {loading ? 'Loading…' : isFav ? 'Убрать из избранного' : 'Сохранить'}
        </Button>
        <Button variant="outline" onClick={() => navigate(-1)}>
          Назад
        </Button>
      </div>
    </div>
  )
}

