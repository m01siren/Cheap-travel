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
