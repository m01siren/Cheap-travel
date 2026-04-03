type LogLevel = 'info' | 'error' | 'debug'

type RequestLogContext = {
  id: string
  context: string
  method: string
  url: string
  path: string
  startTime: number
}

type LogBase = {
  level: LogLevel
  context: string
  timestamp: string
  request_id?: string
}

function redactObject(input: unknown): unknown {
  if (!input || typeof input !== 'object') return input
  const forbiddenKeys = new Set(['authorization', 'apikey', 'password', 'refresh_token', 'access_token'])
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (forbiddenKeys.has(key.toLowerCase())) {
      out[key] = '[redacted]'
    } else if (value && typeof value === 'object') {
      out[key] = redactObject(value)
    } else {
      out[key] = value
    }
  }
  return out
}

function logJson(payload: LogBase & Record<string, unknown>) {
  // Один вызов console.log с уже сериализованным JSON, чтобы в логах Supabase было удобно фильтровать.
  console.log(JSON.stringify(payload))
}

export function startRequestLog(context: string, req: Request): RequestLogContext {
  const url = new URL(req.url)
  const id = crypto.randomUUID()
  const ctx: RequestLogContext = {
    id,
    context,
    method: req.method,
    url: req.url,
    path: url.pathname,
    startTime: Date.now(),
  }

  const headers: Record<string, string> = {}
  req.headers.forEach((v, k) => {
    if (['authorization', 'apikey'].includes(k.toLowerCase())) return
    headers[k] = v
  })

  logJson({
    level: 'info',
    context,
    request_id: id,
    timestamp: new Date().toISOString(),
    event: 'http_request_start',
    method: ctx.method,
    path: ctx.path,
    url: ctx.url,
    headers,
  })

  return ctx
}

export function finishRequestLog(ctx: RequestLogContext, status: number) {
  const durationMs = Date.now() - ctx.startTime
  logJson({
    level: 'info',
    context: ctx.context,
    request_id: ctx.id,
    timestamp: new Date().toISOString(),
    event: 'http_request_end',
    method: ctx.method,
    path: ctx.path,
    status,
    duration_ms: durationMs,
  })
}

export function logError(context: string, err: unknown, extra?: Record<string, unknown>, requestId?: string) {
  const error = err instanceof Error ? err : new Error(String(err))
  logJson({
    level: 'error',
    context,
    request_id: requestId,
    timestamp: new Date().toISOString(),
    event: 'error',
    message: error.message,
    stack: error.stack,
    extra: extra ? redactObject(extra) : undefined,
  })
}

export function logEvent(
  context: string,
  type: string,
  data?: Record<string, unknown>,
  requestId?: string,
) {
  logJson({
    level: 'info',
    context,
    request_id: requestId,
    timestamp: new Date().toISOString(),
    event: type,
    data: data ? redactObject(data) : undefined,
  })
}

