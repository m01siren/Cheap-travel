import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Filters, RouteCard, SearchForm } from '../components/common.jsx'
import { Card, CardContent, CardHeader } from '../components/ui.jsx'
import { mockRoutes, routePathText, sumDuration, sumPrice } from '../data/mockRoutes.js'

function includesText(haystack, needle) {
  const h = String(haystack || '').toLowerCase()
  const n = String(needle || '').toLowerCase().trim()
  if (!n) return true
  return h.includes(n)
}

export function ResultsPage() {
  const [params] = useSearchParams()
  const query = useMemo(
    () => ({
      from: params.get('from') || '',
      to: params.get('to') || '',
      dateFrom: params.get('dateFrom') || '',
      dateTo: params.get('dateTo') || '',
      transport: params.get('transport') || 'all',
    }),
    [params],
  )

  const [loading, setLoading] = useState(true)

  // Локальные фильтры (это именно UI-фильтры на странице).
  const [filters, setFilters] = useState({
    maxPrice: '',
    maxDuration: '',
    mode: 'all',
  })

  useEffect(() => {
    setLoading(true)
    const t = setTimeout(() => setLoading(false), 250)
    return () => clearTimeout(t)
  }, [query.from, query.to, query.dateFrom, query.dateTo, query.transport])

  const routes = useMemo(() => {
    const bySearch = mockRoutes.filter((r) => {
      const path = routePathText(r.segments)
      const matchFrom = includesText(path, query.from)
      const matchTo = includesText(path, query.to)
      const matchTransport =
        query.transport === 'all' ? true : r.segments.some((s) => s.mode === query.transport)
      return matchFrom && matchTo && matchTransport
    })

    const maxPrice = filters.maxPrice ? Number(filters.maxPrice) : null
    const maxDuration = filters.maxDuration ? Number(filters.maxDuration) : null
    const mode = filters.mode

    const filtered = bySearch.filter((r) => {
      const price = sumPrice(r.segments)
      const duration = sumDuration(r.segments)

      if (maxPrice != null && Number.isFinite(maxPrice) && price > maxPrice) return false
      if (maxDuration != null && Number.isFinite(maxDuration) && duration > maxDuration) return false

      if (mode !== 'all' && !r.segments.some((s) => s.mode === mode)) return false
      return true
    })

    // Сортировка по цене (по умолчанию).
    filtered.sort((a, b) => sumPrice(a.segments) - sumPrice(b.segments))
    return filtered
  }, [filters.maxDuration, filters.maxPrice, filters.mode, query.from, query.to, query.transport])

  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Результаты</h1>
        <p className="text-sm text-white/80">
          Параметры: {query.from || '—'} → {query.to || '—'}
          {query.transport !== 'all' ? `, ${query.transport}` : ''}
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="text-sm font-semibold text-white/95">Поиск (быстро изменить)</div>
        </CardHeader>
        <CardContent>
          <SearchForm initialValues={query} />
        </CardContent>
      </Card>

      <Filters value={filters} onChange={setFilters} />

      {loading ? (
        <div className="text-sm text-white/80">Loading…</div>
      ) : routes.length === 0 ? (
        <div className="text-sm text-white/80">Ничего не найдено</div>
      ) : (
        <div className="grid gap-3">
          {routes.map((r) => (
            <RouteCard key={r.id} route={r} />
          ))}
        </div>
      )}
    </div>
  )
}

