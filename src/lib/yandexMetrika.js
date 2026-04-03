/**
 * Яндекс.Метрика (tag.js): базовый счётчик + вебвизор.
 * ID: VITE_YANDEX_METRIKA_ID (локально — .env; Docker/Amvera — window.__APP_CONFIG__ из env-config).
 */

import { getEnv } from './env.js'

let metrikaInitialized = false

function getCounterId() {
  let raw = getEnv('VITE_YANDEX_METRIKA_ID', '')
  if (raw === '' && typeof document !== 'undefined') {
    const meta = document.querySelector('meta[name="yandex-metrika-counter"]')
    const fromMeta = meta?.getAttribute('content')?.trim()
    if (fromMeta) raw = fromMeta
  }
  if (raw === '') return null
  const id = Number(String(raw).trim())
  return Number.isFinite(id) && id > 0 ? id : null
}

export function initYandexMetrika() {
  const id = getCounterId()
  if (id == null || typeof window === 'undefined') return
  if (metrikaInitialized) return
  metrikaInitialized = true

  ;(function (m, e, t, r, i, k, a) {
    m[i] =
      m[i] ||
      function () {
        ;(m[i].a = m[i].a || []).push(arguments)
      }
    m[i].l = 1 * new Date()
    for (let j = 0; j < document.scripts.length; j++) {
      if (document.scripts[j].src === r) return
    }
    k = e.createElement(t)
    a = e.getElementsByTagName(t)[0]
    k.async = 1
    k.src = r
    a.parentNode.insertBefore(k, a)
  })(window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js', 'ym')

  window.ym(id, 'init', {
    clickmap: true,
    trackLinks: true,
    accurateTrackBounce: true,
    webvisor: true,
  })
}

/**
 * Хит при смене маршрута SPA (полный path + query).
 */
export function hitYandexMetrika(path) {
  const id = getCounterId()
  if (id == null || typeof window === 'undefined' || typeof window.ym !== 'function') return
  const p =
    path != null && path !== ''
      ? path
      : `${window.location.pathname}${window.location.search}${window.location.hash || ''}`
  window.ym(id, 'hit', p)
}
