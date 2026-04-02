import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Filters, RouteCard, SearchForm } from '../components/common.jsx'
import { Button, Card, CardContent, CardHeader } from '../components/ui.jsx'
import { routePathText, sumDuration, sumPrice } from '../utils/routeUtils.js'
import { combineRoutes, fetchRoutes, fetchRoutesLive } from '../data/routesApi.js'
import { hasExternalRoutesSource } from '../data/externalRoutesApi.js'
import { logSearchHistory } from '../data/socialApi.js'
import { useAuth } from '../hooks/useAuth.js'
import { createBrowserSearchJob, getBrowserSearchResults, getBrowserSearchStatus } from '../data/browserSearchApi.js'

function includesText(haystack, needle) {
  const h = String(haystack || '').toLowerCase()
  const n = String(needle || '').toLowerCase().trim()
  if (!n) return true
  return h.includes(n)
}

export function ResultsPage() {
  const { user, loading: authLoading } = useAuth()
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
  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')
  const [allRoutes, setAllRoutes] = useState([])
  const [fallbackInfo, setFallbackInfo] = useState('')
  const [browserJobId, setBrowserJobId] = useState('')
  const [browserStatus, setBrowserStatus] = useState('')
  const [browserBusy, setBrowserBusy] = useState(false)
  const [browserInfo, setBrowserInfo] = useState('')

  // Локальные фильтры (это именно UI-фильтры на странице).
  const [filters, setFilters] = useState({
    maxPrice: '',
    maxDuration: '',
    mode: 'all',
  })

  useEffect(() => {
    let cancelled = false

    async function loadRoutes() {
      setLoading(true)
      setError('')
      setWarning('')
      setFallbackInfo('')

      let dbRoutes = []
      let liveRoutes = []
      let dbError = null
      let liveError = null

      try {
        dbRoutes = await fetchRoutes()
      } catch (e) {
        dbError = e
      }

      try {
        liveRoutes = await fetchRoutesLive(query)
      } catch (e) {
        liveError = e
      }

      if (cancelled) return

      const merged = combineRoutes(dbRoutes, liveRoutes)
      setAllRoutes(merged)

      if (dbError && liveError) {
        setError('Не удалось загрузить маршруты: база и внешние источники временно недоступны.')
      } else if (dbError && liveRoutes.length) {
        setWarning('Маршруты из базы временно недоступны. Показаны только внешние источники.')
      } else if (dbError && !liveRoutes.length) {
        setWarning('Маршруты из базы временно недоступны.')
      } else if (liveError) {
        setWarning('Показаны локальные маршруты. Внешний источник временно недоступен.')
      } else if (!liveRoutes.length && !hasExternalRoutesSource) {
        setWarning('Внешний источник маршрутов не подключён. Показаны только маршруты из вашей базы.')
      }

      if (!cancelled) setLoading(false)
    }

    loadRoutes()
    return () => {
      cancelled = true
    }
  }, [query])

  useEffect(() => {
    if (authLoading || !user) return
    logSearchHistory({
      userId: user.id,
      originCity: query.from,
      destinationCity: query.to,
      departFrom: query.dateFrom || null,
      departTo: query.dateTo || null,
      transport: query.transport,
      maxPrice: null,
      filtersJson: {},
    }).catch(() => {})
  }, [authLoading, user, query.from, query.to, query.dateFrom, query.dateTo, query.transport])

  const routesData = useMemo(() => {
    const bySearch = allRoutes.filter((r) => {
      const path = routePathText(r.segments)
      const matchFrom = includesText(path, query.from)
      const matchTo = includesText(path, query.to)
      const matchTransport =
        query.transport === 'all' ? true : r.segments.some((s) => s.mode === query.transport)
      return matchFrom && matchTo && matchTransport
    })

    const byOriginOnly = allRoutes.filter((r) => {
      const path = routePathText(r.segments)
      const matchFrom = includesText(path, query.from)
      const matchTransport =
        query.transport === 'all' ? true : r.segments.some((s) => s.mode === query.transport)
      return matchFrom && matchTransport
    })

    const maxPrice = filters.maxPrice ? Number(filters.maxPrice) : null
    const maxDuration = filters.maxDuration ? Number(filters.maxDuration) : null
    const mode = filters.mode

    const applyUiFilters = (list) =>
      list.filter((r) => {
        const price = sumPrice(r.segments)
        const duration = sumDuration(r.segments)

        if (maxPrice != null && Number.isFinite(maxPrice) && price > maxPrice) return false
        if (maxDuration != null && Number.isFinite(maxDuration) && duration > maxDuration) return false

        if (mode !== 'all' && !r.segments.some((s) => s.mode === mode)) return false
        return true
      })

    const filteredExact = applyUiFilters(bySearch)
    const filteredFallback = applyUiFilters(byOriginOnly)

    const sortRoutes = (list) => {
      const sorted = [...list]
      sorted.sort((a, b) => {
        if (Number.isFinite(a.score) || Number.isFinite(b.score)) {
          return (a.score ?? Number.MAX_SAFE_INTEGER) - (b.score ?? Number.MAX_SAFE_INTEGER)
        }
        return sumPrice(a.segments) - sumPrice(b.segments)
      })
      return sorted
    }

    if (filteredExact.length > 0) {
      return { routes: sortRoutes(filteredExact), isFallback: false }
    }

    if (query.from && filteredFallback.length > 0) {
      return { routes: sortRoutes(filteredFallback), isFallback: true }
    }

    return { routes: [], isFallback: false }
  }, [allRoutes, filters.maxDuration, filters.maxPrice, filters.mode, query.from, query.to, query.transport])

  useEffect(() => {
    if (routesData.isFallback) {
      setFallbackInfo(
        `Точного маршрута "${query.from || '—'} → ${query.to || '—'}" не найдено. Показаны ближайшие варианты из "${query.from || 'вашего города'}".`,
      )
    } else {
      setFallbackInfo('')
    }
  }, [query.from, query.to, routesData.isFallback])

  const routes = routesData.routes

  async function onBrowserSearch() {
    try {
      setBrowserBusy(true)
      setBrowserStatus('running')
      setBrowserInfo('Запущен поиск на сайтах...')
      const job = await createBrowserSearchJob({
        from: query.from,
        to: query.to,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        transport: query.transport,
      })
      const jobId = job?.job_id
      setBrowserJobId(jobId)
    } catch (e) {
      setBrowserStatus('error')
      setBrowserInfo(e.message || 'Не удалось запустить browser-поиск')
      setBrowserBusy(false)
    }
  }

  useEffect(() => {
    if (!browserJobId) return
    let active = true

    async function poll() {
      try {
        const status = await getBrowserSearchStatus(browserJobId)
        if (!active) return
        setBrowserStatus(status.status)
        if (status.status === 'done') {
          const payload = await getBrowserSearchResults(browserJobId)
          if (!active) return
          if (Array.isArray(payload?.routes) && payload.routes.length) {
            setAllRoutes((prev) => combineRoutes(prev, payload.routes))
            setBrowserInfo(`Найдено на сайтах: ${payload.routes.length}`)
          } else {
            setBrowserInfo('Browser-поиск завершён, новых маршрутов не найдено')
          }
          setBrowserBusy(false)
          return
        }

        if (status.status === 'error' || status.status === 'timeout' || status.status === 'cancelled') {
          setBrowserInfo(status.error_message || 'Browser-поиск завершился с ошибкой')
          setBrowserBusy(false)
          return
        }
      } catch (e) {
        if (!active) return
        setBrowserStatus('error')
        setBrowserInfo(e.message || 'Ошибка при проверке статуса browser-поиска')
        setBrowserBusy(false)
        return
      }

      setTimeout(() => {
        if (active) poll()
      }, 2500)
    }

    poll()
    return () => {
      active = false
    }
  }, [browserJobId])

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
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" onClick={onBrowserSearch} disabled={browserBusy}>
          {browserBusy ? 'Ищем на сайтах...' : 'Найти на сайтах'}
        </Button>
        {browserStatus ? <span className="text-xs text-white/80">Статус: {browserStatus}</span> : null}
      </div>
      {browserInfo ? <div className="text-xs text-white/80">{browserInfo}</div> : null}
      {warning ? <div className="text-xs text-amber-200">{warning}</div> : null}
      {fallbackInfo ? <div className="text-xs text-white/80">{fallbackInfo}</div> : null}

      {loading ? (
        <div className="text-sm text-white/80">Загрузка...</div>
      ) : error ? (
        <div className="text-sm text-red-200">{error}</div>
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

