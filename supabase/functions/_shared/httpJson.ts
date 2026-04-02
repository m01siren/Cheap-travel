/** Дефолт для локальной разработки и Playwright; в проде задайте CORS_ALLOWED_ORIGINS в secrets Edge Functions. */
const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
]

export function getAllowedOrigins(): string[] {
  const raw = Deno.env.get('CORS_ALLOWED_ORIGINS')?.trim()
  const fromEnv = raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : []
  // Если заданы прод-ориджины, не убираем localhost — иначе ломается локальная разработка.
  const merged = [...DEFAULT_ALLOWED_ORIGINS, ...fromEnv]
  return [...new Set(merged)]
}

/**
 * CORS: только перечисленные в CORS_ALLOWED_ORIGINS (или дефолт localhost).
 * Без заголовка Origin (curl, сервер-к-серверу) — ответ без ACAO, тело всё равно отдаётся.
 */
export function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin')
  const allowed = getAllowedOrigins()
  const base: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  }
  if (!origin) return base
  if (allowed.includes(origin)) {
    return {
      ...base,
      'Access-Control-Allow-Origin': origin,
      Vary: 'Origin',
    }
  }
  return base
}

/** Origin указан и не из списка — браузерный запрос отклоняем. */
export function isOriginForbidden(req: Request): boolean {
  const origin = req.headers.get('Origin')
  if (!origin) return false
  return !getAllowedOrigins().includes(origin)
}

export function handleCorsPreflight(req: Request): Response {
  if (isOriginForbidden(req)) {
    return new Response(null, { status: 403 })
  }
  return new Response(null, { status: 204, headers: corsHeadersFor(req) })
}

export function json(status: number, body: unknown, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  })
}

export function jsonCors(
  req: Request,
  status: number,
  body: unknown,
  extraHeaders: Record<string, string> = {},
) {
  return json(status, body, { ...corsHeadersFor(req), ...extraHeaders })
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isUuid(value: string): boolean {
  return UUID_RE.test(value.trim())
}

/** Ответ 500 без деталей исключения (детали только в логах). */
export function internalError(context: string, e: unknown, req?: Request) {
  const err = e instanceof Error ? e : new Error(String(e))
  console.error(`[${context}]`, err)
  if (req) {
    return jsonCors(req, 500, { message: 'Внутренняя ошибка сервера' })
  }
  return json(500, { message: 'Внутренняя ошибка сервера' })
}
