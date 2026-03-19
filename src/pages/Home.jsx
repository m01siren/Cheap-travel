import { Card, CardContent, CardHeader } from '../components/ui.jsx'
import { SearchForm } from '../components/common.jsx'

export function HomePage() {
  return (
    <div className="grid gap-6">
      <div className="grid gap-2" />
      <Card>
        <CardHeader>
          <div className="text-sm font-semibold text-white/95">Поиск</div>
        </CardHeader>
        <CardContent>
          <SearchForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="text-sm font-semibold text-white/95">Примеры маршрутов</div>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 text-sm text-white/90">
            <li className="rounded-md border border-white/25 bg-white/10 p-3">
              Москва → Минск → Варшава
            </li>
            <li className="rounded-md border border-white/25 bg-white/10 p-3">
              Санкт‑Петербург → Хельсинки
            </li>
            <li className="rounded-md border border-white/25 bg-white/10 p-3">
              Казань → Москва → Стамбул
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

