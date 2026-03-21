import { useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'tce:favorites'

function safeParse(json, fallback) {
  try {
    const parsed = JSON.parse(json)
    return parsed ?? fallback
  } catch {
    return fallback
  }
}

export function useFavorites() {
  const [ids, setIds] = useState(() => {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = safeParse(raw, [])
    return Array.isArray(parsed) ? parsed : []
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
  }, [ids])

  const set = useMemo(() => new Set(ids), [ids])

  function isFavorite(id) {
    return set.has(id)
  }

  function remove(id) {
    setIds((prev) => prev.filter((x) => x !== id))
  }

  function toggle(id) {
    setIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  return { ids, isFavorite, remove, toggle }
}
