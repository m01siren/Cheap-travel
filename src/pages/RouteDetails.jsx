import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Card, CardContent, CardHeader, Badge, Label } from '../components/ui.jsx'
import { useFavorites } from '../hooks/useFavorites.js'
import { useAuth } from '../hooks/useAuth.js'
import { modeLabel, routePathText, sumDuration, sumPrice } from '../utils/routeUtils.js'
import { fetchRouteById } from '../data/routesApi.js'
import {
  addComment,
  fetchComments,
  fetchPriceHistory,
  fetchUserVote,
  fetchVoteStats,
  removeVote,
  setVote,
} from '../data/socialApi.js'

export function RouteDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, role } = useAuth()
  const favorites = useFavorites()
  const [route, setRoute] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const [voteStats, setVoteStats] = useState({ likes_count: 0, dislikes_count: 0, score: 0 })
  const [myVote, setMyVote] = useState(null)
  const [voteBusy, setVoteBusy] = useState(false)
  const [voteError, setVoteError] = useState('')

  const [comments, setComments] = useState([])
  const [commentsLoading, setCommentsLoading] = useState(true)
  const [commentText, setCommentText] = useState('')
  const [commentBusy, setCommentBusy] = useState(false)
  const [commentError, setCommentError] = useState('')

  const [priceHistory, setPriceHistory] = useState([])
  const [priceHistoryLoading, setPriceHistoryLoading] = useState(true)
  const [socialError, setSocialError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadRoute() {
      try {
        setLoading(true)
        setError('')
        const data = await fetchRouteById(id)
        if (!cancelled) setRoute(data)
      } catch (e) {
        if (!cancelled) setError(e.message || 'Не удалось загрузить маршрут')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadRoute()
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    if (!route?.id) return
    let cancelled = false

    async function loadSocial() {
      try {
        setSocialError('')
        setCommentsLoading(true)
        setPriceHistoryLoading(true)
        const [stats, vote, list, prices] = await Promise.all([
          fetchVoteStats(route.id),
          fetchUserVote(route.id, user?.id),
          fetchComments(route.id),
          fetchPriceHistory(route.id, 15),
        ])
        if (cancelled) return
        setVoteStats(stats)
        setMyVote(vote)
        setComments(list)
        setPriceHistory(prices)
      } catch (e) {
        if (!cancelled) setSocialError(e.message || 'Не удалось загрузить дополнительные данные')
      } finally {
        if (!cancelled) {
          setCommentsLoading(false)
          setPriceHistoryLoading(false)
        }
      }
    }

    loadSocial()
    return () => {
      cancelled = true
    }
  }, [route?.id, user?.id])

  if (loading) {
    return <div className="text-sm text-white/80">Загрузка...</div>
  }

  if (error) {
    return <div className="text-sm text-red-200">{error}</div>
  }

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
  const currency = route.currency || 'RUB'
  const priceSuffix = currency === 'RUB' ? '₽' : currency

  const isOwnRoute = user && route.ownerId && user.id === route.ownerId
  const canComment = user && (!isOwnRoute || role === 'admin')

  async function onSave() {
    try {
      setSaving(true)
      setSaveError('')
      await favorites.toggle(route.id)
    } catch (e) {
      setSaveError(e.message || 'Не удалось сохранить маршрут')
    } finally {
      setSaving(false)
    }
  }

  async function onVote(next) {
    try {
      setVoteBusy(true)
      setVoteError('')
      if (!user) {
        setVoteError('Войдите, чтобы голосовать')
        return
      }
      if (myVote === next) {
        await removeVote(route.id, user.id)
        setMyVote(null)
      } else {
        await setVote(route.id, user.id, next)
        setMyVote(next)
      }
      const stats = await fetchVoteStats(route.id)
      setVoteStats(stats)
    } catch (e) {
      setVoteError(e.message || 'Не удалось сохранить голос')
    } finally {
      setVoteBusy(false)
    }
  }

  async function onSendComment(e) {
    e.preventDefault()
    if (!user) {
      setCommentError('Войдите, чтобы комментировать')
      return
    }
    try {
      setCommentBusy(true)
      setCommentError('')
      await addComment(route.id, user.id, commentText)
      setCommentText('')
      const list = await fetchComments(route.id)
      setComments(list)
    } catch (e) {
      setCommentError(e.message || 'Не удалось отправить комментарий')
    } finally {
      setCommentBusy(false)
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-white">{route.title}</h1>
          <p className="text-sm text-white/80">{path}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge>
            {price.toLocaleString()} {priceSuffix}
          </Badge>
          <Badge>{Math.round(duration / 60)} ч</Badge>
          <Badge>{transfers === 0 ? 'Без пересадок' : `Пересадки: ${transfers}`}</Badge>
          <Badge title="Рейтинг">
            👍 {voteStats.likes_count ?? 0} / 👎 {voteStats.dislikes_count ?? 0}
          </Badge>
        </div>
      </div>

      {socialError ? <div className="text-sm text-amber-200">{socialError}</div> : null}

      <Card>
        <CardHeader>
          <div className="text-sm font-semibold text-white/95">Оценка маршрута</div>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant={myVote === 1 ? 'default' : 'outline'} disabled={voteBusy} onClick={() => onVote(1)}>
              Лайк
            </Button>
            <Button type="button" variant={myVote === -1 ? 'default' : 'outline'} disabled={voteBusy} onClick={() => onVote(-1)}>
              Дизлайк
            </Button>
          </div>
          {voteError ? <div className="text-sm text-red-200">{voteError}</div> : null}
        </CardContent>
      </Card>

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

                <div className="rounded-md border border-white/25 bg-white/10 p-3 text-sm text-white/80">
                  <div className="flex flex-wrap items-center gap-3">
                    <span>
                      <span className="text-white/95">Время:</span> {Math.round(s.durationMin / 60)} ч
                    </span>
                    <span>
                      <span className="text-white/95">Цена:</span> {s.price.toLocaleString()} {priceSuffix}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="text-sm font-semibold text-white/95">История цен</div>
        </CardHeader>
        <CardContent className="grid gap-2">
          {priceHistoryLoading ? (
            <div className="text-sm text-white/80">Загрузка...</div>
          ) : priceHistory.length === 0 ? (
            <div className="text-sm text-white/80">Пока нет записей (история добавляется на бэкенде).</div>
          ) : (
            <ul className="grid gap-2 text-sm text-white/90">
              {priceHistory.map((row) => (
                <li key={row.id} className="rounded-md border border-white/20 bg-white/10 px-3 py-2">
                  {new Date(row.captured_at).toLocaleString()} — {Number(row.price).toLocaleString()} {row.currency}
                  {row.source ? ` (${row.source})` : ''}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="text-sm font-semibold text-white/95">Комментарии</div>
        </CardHeader>
        <CardContent className="grid gap-4">
          {commentsLoading ? (
            <div className="text-sm text-white/80">Загрузка...</div>
          ) : comments.length === 0 ? (
            <div className="text-sm text-white/80">Пока нет комментариев.</div>
          ) : (
            <ul className="grid gap-3">
              {comments.map((c) => (
                <li key={c.id} className="rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm text-white/90">
                  <div className="text-xs text-white/70">
                    {c.authorDisplayName || 'Пользователь'} · {new Date(c.created_at).toLocaleString()}
                  </div>
                  <div className="mt-1 whitespace-pre-wrap">{c.content}</div>
                </li>
              ))}
            </ul>
          )}

          {canComment ? (
            <form onSubmit={onSendComment} className="grid gap-2">
              <Label htmlFor="comment">Ваш комментарий</Label>
              <textarea
                id="comment"
                rows={3}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Напишите комментарий к чужому маршруту…"
                className="min-h-[88px] w-full rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-sm text-white outline-none placeholder:text-white/60 focus:border-white/50 focus:ring-2 focus:ring-white/20"
              />
              {commentError ? <div className="text-sm text-red-200">{commentError}</div> : null}
              <div>
                <Button type="submit" disabled={commentBusy || !commentText.trim()}>
                  {commentBusy ? 'Загрузка...' : 'Отправить'}
                </Button>
              </div>
            </form>
          ) : (
            <div className="text-sm text-white/80">
              {isOwnRoute
                ? 'Комментарии к собственному маршруту недоступны.'
                : 'Войдите, чтобы оставить комментарий.'}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={onSave} disabled={saving}>
          {saving ? 'Загрузка...' : isFav ? 'Убрать из избранного' : 'Сохранить'}
        </Button>
        <Button variant="outline" onClick={() => navigate(-1)}>
          Назад
        </Button>
      </div>
      {saveError ? <div className="text-sm text-red-200">{saveError}</div> : null}
    </div>
  )
}
