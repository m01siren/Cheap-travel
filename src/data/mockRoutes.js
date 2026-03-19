// Моковые данные маршрутов (как будто пришли с API).
// Позже это легко заменить на реальный запрос.

export const mockRoutes = [
  {
    id: 'r1',
    segments: [
      {
        from: 'Москва',
        to: 'Минск',
        mode: 'train',
        durationMin: 420,
        price: 3200,
      },
      {
        from: 'Минск',
        to: 'Варшава',
        mode: 'bus',
        durationMin: 480,
        price: 2600,
      },
    ],
  },
  {
    id: 'r2',
    segments: [
      {
        from: 'Санкт‑Петербург',
        to: 'Хельсинки',
        mode: 'bus',
        durationMin: 480,
        price: 2900,
      },
    ],
  },
  {
    id: 'r3',
    segments: [
      {
        from: 'Казань',
        to: 'Москва',
        mode: 'train',
        durationMin: 720,
        price: 4200,
      },
      {
        from: 'Москва',
        to: 'Стамбул',
        mode: 'plane',
        durationMin: 240,
        price: 9900,
      },
    ],
  },
  {
    id: 'r4',
    segments: [
      {
        from: 'Екатеринбург',
        to: 'Москва',
        mode: 'plane',
        durationMin: 150,
        price: 8200,
      },
      {
        from: 'Москва',
        to: 'Париж',
        mode: 'plane',
        durationMin: 255,
        price: 14900,
      },
    ],
  },
  {
    id: 'r5',
    segments: [
      {
        from: 'Новосибирск',
        to: 'Омск',
        mode: 'train',
        durationMin: 420,
        price: 2100,
      },
      {
        from: 'Омск',
        to: 'Астана',
        mode: 'bus',
        durationMin: 600,
        price: 3100,
      },
    ],
  },
]

export function modeLabel(mode) {
  if (mode === 'plane') return 'Самолёт'
  if (mode === 'train') return 'Поезд'
  if (mode === 'bus') return 'Автобус'
  return '—'
}

export function sumPrice(segments) {
  return segments.reduce((acc, s) => acc + s.price, 0)
}

export function sumDuration(segments) {
  return segments.reduce((acc, s) => acc + s.durationMin, 0)
}

export function routePathText(segments) {
  if (!segments.length) return ''
  const points = [segments[0].from, ...segments.map((s) => s.to)]
  return points.join(' → ')
}

