export function logProviderRequest(provider, endpoint, payload) {
  console.info(`[provider:${provider}] request -> ${endpoint}`, payload)
}

export function logProviderResponse(provider, endpoint, payload) {
  console.info(`[provider:${provider}] response <- ${endpoint}`, payload)
}

export function logProviderError(provider, endpoint, error, payload) {
  console.error(`[provider:${provider}] error @ ${endpoint}`, {
    message: error instanceof Error ? error.message : String(error),
    payload,
  })
}
