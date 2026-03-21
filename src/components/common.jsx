import { Link, NavLink, useNavigate } from 'react-router-dom'
import { Badge, Button, Card, CardContent, CardHeader, Input, Label, Select } from './ui.jsx'
import { modeLabel, routePathText, sumDuration, sumPrice } from '../data/mockRoutes.js'

export function Header() {
  const linkBase =
    'rounded-full px-3 py-2 text-sm font-medium text-white/85 transition-colors hover:bg-white/10 active:translate-y-px'
  const linkActive = 'bg-white/20 text-white border border-white/25'

  return (
    <header className="sticky top-0 z-20">
      <div className="mx-auto my-3 flex max-w-5xl items-center justify-between rounded-full bg-white/15 px-4 py-2 backdrop-blur-md">
        <Link to="/" className="text-sm font-semibold tracking-tight text-[#FFF9D7]">
          Путешествуй доступно
        </Link>
        <nav className="flex items-center gap-2">
          <NavLink to="/" end className={({ isActive }) => `${linkBase} ${isActive ? linkActive : ''}`}>
            Home
          </NavLink>
          <NavLink
            to="/favorites"
            className={({ isActive }) => `${linkBase} ${isActive ? linkActive : ''}`}
          >
            Favorites
          </NavLink>
        </nav>
      </div>
    </header>
  )
}

export function SearchForm({ initialValues }) {
  const navigate = useNavigate()
  const defaults = {
    from: '',
    to: '',
    dateFrom: '',
    dateTo: '',
    transport: 'all',
    ...initialValues,
  }

  function onSubmit(e) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const params = new URLSearchParams()

    ;['from', 'to', 'dateFrom', 'dateTo', 'transport'].forEach((key) => {
      const value = String(fd.get(key) ?? '').trim()
      if (value) params.set(key, value)
    })

    navigate(`/results?${params.toString()}`)
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="from">Откуда</Label>
          <Input id="from" name="from" defaultValue={defaults.from} placeholder="например, Москва" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="to">Куда</Label>
          <Input id="to" name="to" defaultValue={defaults.to} placeholder="например, Париж" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor="dateFrom">Дата (туда)</Label>
          <Input id="dateFrom" name="dateFrom" type="date" defaultValue={defaults.dateFrom} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="dateTo">Дата (обратно)</Label>
          <Input id="dateTo" name="dateTo" type="date" defaultValue={defaults.dateTo} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="transport">Транспорт</Label>
          <Select id="transport" name="transport" defaultValue={defaults.transport}>
            <option value="all">Все</option>
            <option value="plane">Самолёт</option>
            <option value="train">Поезд</option>
            <option value="bus">Автобус</option>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit">Найти</Button>
      </div>
    </form>
  )
}

export function Filters({ value, onChange }) {
  return (
    <Card>
      <CardHeader>
        <div className="text-sm font-semibold text-white/95">Фильтры</div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="grid gap-1.5">
            <Label htmlFor="maxPrice">Цена до</Label>
            <Input
              id="maxPrice"
              type="number"
              min="0"
              value={value.maxPrice}
              onChange={(e) => onChange({ ...value, maxPrice: e.target.value })}
              placeholder="например, 10000"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="maxDuration">Время до (мин)</Label>
            <Input
              id="maxDuration"
              type="number"
              min="0"
              value={value.maxDuration}
              onChange={(e) => onChange({ ...value, maxDuration: e.target.value })}
              placeholder="например, 600"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="mode">Тип транспорта</Label>
            <Select
              id="mode"
              value={value.mode}
              onChange={(e) => onChange({ ...value, mode: e.target.value })}
            >
              <option value="all">Все</option>
              <option value="plane">Самолёт</option>
              <option value="train">Поезд</option>
              <option value="bus">Автобус</option>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function RouteCard({ route, showActions = true, actions }) {
  const price = sumPrice(route.segments)
  const duration = sumDuration(route.segments)
  const transfers = Math.max(0, route.segments.length - 1)
  const path = routePathText(route.segments)

  const modes = Array.from(new Set(route.segments.map((s) => s.mode)))

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-base font-semibold text-white">{price.toLocaleString()} ₽</div>
          <Badge>{Math.round(duration / 60)} ч</Badge>
          <Badge>{transfers === 0 ? 'Без пересадок' : `Пересадки: ${transfers}`}</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {modes.map((m) => (
            <Badge key={m}>{modeLabel(m)}</Badge>
          ))}
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="text-sm text-white/90">{path}</div>
        {showActions && (
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={`/route/${route.id}`}
              className="inline-flex h-10 items-center justify-center rounded-full border border-white/25 bg-white/20 px-5 py-2 text-sm font-medium text-white transition-all hover:brightness-95 active:translate-y-px"
            >
              Открыть
            </Link>
            {actions}
          </div>
        )}
      </CardContent>
    </Card>
  )
}


