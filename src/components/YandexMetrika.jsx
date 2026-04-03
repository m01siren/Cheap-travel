import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { hitYandexMetrika, initYandexMetrika } from '../lib/yandexMetrika.js'

/** Подключает счётчик и отправляет hit при смене страницы (SPA). */
export function YandexMetrika() {
  const location = useLocation()

  useEffect(() => {
    initYandexMetrika()
  }, [])

  useEffect(() => {
    hitYandexMetrika(`${location.pathname}${location.search}${location.hash || ''}`)
  }, [location])

  return null
}
