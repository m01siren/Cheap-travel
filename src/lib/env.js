function getRuntimeConfig() {
  if (typeof window === 'undefined') return {}
  return window.__APP_CONFIG__ || {}
}

export function getEnv(name, fallback = '') {
  const runtime = getRuntimeConfig()
  const runtimeValue = runtime[name]
  if (runtimeValue != null && String(runtimeValue).trim() !== '') return String(runtimeValue).trim()

  const buildTimeValue = import.meta.env?.[name]
  if (buildTimeValue != null && String(buildTimeValue).trim() !== '') return String(buildTimeValue).trim()

  return fallback
}
