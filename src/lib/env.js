function getRuntimeConfig() {
  if (typeof window === 'undefined') return {}
  return window.__APP_CONFIG__ || {}
}

export function getEnv(name, fallback = '') {
  const runtime = getRuntimeConfig()
  const runtimeValue = runtime[name]
  if (runtimeValue != null && String(runtimeValue) !== '') return String(runtimeValue)

  const buildTimeValue = import.meta.env?.[name]
  if (buildTimeValue != null && String(buildTimeValue) !== '') return String(buildTimeValue)

  return fallback
}
