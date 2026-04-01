# Путешествуй доступно (Cheap travel)

Фронтенд на **React + Vite** с **Supabase** (маршруты, избранное, история поиска, голоса, комментарии, история цен).

## Требования

- Node.js 18+
- npm
- Проект в Supabase

## Настройка Supabase

1. Создайте проект на [supabase.com](https://supabase.com).
2. В **SQL Editor** выполните целиком файл **[`supabase/schema.sql`](supabase/schema.sql)** (таблицы, триггеры, роли, RLS, view `route_vote_stats`).
3. При пустой таблице `routes` можно выполнить **[`supabase/seed_example.sql`](supabase/seed_example.sql)** — тестовые маршруты.
4. В **Authentication → Providers** включите **Email** (логин/пароль).
5. В **Project Settings → API** скопируйте **Project URL** и **anon public** ключ.
6. **Лимит входа/регистрации (10 попыток / 15 мин с IP):** в конце [`supabase/schema.sql`](supabase/schema.sql) добавлены таблица `auth_rate_limit_buckets` и функция `try_auth_rate_limit`. Если вы уже применяли схему раньше, выполните в **SQL Editor** только этот новый блок (или весь файл поверх — он идемпотентен там, где возможно).
7. Задеплойте функции прокси авторизации (нужны те же секреты, что и у других Edge Functions: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`):
   ```bash
   npx supabase functions deploy auth-login
   npx supabase functions deploy auth-register
   ```
   Фронт вызывает `POST .../functions/v1/auth-login` и `.../auth-register` (в dev через Vite прокси это же доступно как `POST /api/auth/login` и `POST /api/auth/register`). При превышении лимита ответ **429** с текстом на русском. Прямой вызов GoTrue API с браузера по-прежнему возможен технически и **не** считается этим лимитом; полная блокировка только через прокси на своём домене/WAF.
8. **CORS для Edge Functions:** в secrets задайте `CORS_ALLOWED_ORIGINS` — список через запятую (например `https://мой-сайт.ru,http://localhost:5173`). Если не задано, разрешены только локальные origin `localhost` / `127.0.0.1` на портах 5173 и 4173. Заголовок `Access-Control-Allow-Origin` выставляется в **конкретный** origin запроса, не `*`.

## Переменные окружения

В корне проекта создайте файл `.env` (или скопируйте из примера):

```env
VITE_SUPABASE_URL=https://ВАШ_ПРОЕКТ.supabase.co
VITE_SUPABASE_ANON_KEY=ваш_anon_ключ
VITE_EXTERNAL_ROUTES_URL=https://open-data-provider.example/routes
VITE_ENABLE_OSM_SOURCES=true
```

## Установка и запуск

```bash
npm install
npm run dev
```

Откройте в браузере адрес из терминала (обычно `http://localhost:5173`).

### Другие команды

```bash
npm run build    # production-сборка
npm run preview  # локальный просмотр сборки
npm run lint     # ESLint
```

## Структура данных (кратко)

| Таблица | Назначение |
|--------|------------|
| `profiles` | Профиль пользователя (`role`: `user` или `admin`) |
| `routes` | Маршруты (`segments` — JSONB с сегментами) |
| `favorites` | Избранное пользователя |
| `search_history` | История поиска (пишется с страницы результатов для авторизованных) |
| `route_votes` | Лайки/дизлайки |
| `route_comments` | Комментарии (нельзя к своему маршруту — правило в RLS) |
| `price_history` | История цен (запись обычно с **service_role** / Edge Function) |

## Примечания

- История цен на проде заполняется отдельным процессом с **service key** (не с фронта).
- Старый файл `supabase_favorites_rls.sql` удалён — всё объединено в **`supabase/schema.sql`**.
- Комбинированный поиск маршрутов работает так: сначала данные из `routes` в Supabase, затем live-догрузка из `VITE_EXTERNAL_ROUTES_URL` (если задан URL).
- Дополнительно подключены открытые источники OSM/OSRM (геокодирование + построение маршрутов) — работают даже без `VITE_EXTERNAL_ROUTES_URL`, если `VITE_ENABLE_OSM_SOURCES=true`.
- Интегрированы провайдеры: Яндекс Расписания, OSM Nominatim, OSRM, ЦБ РФ (курсы), Aviationstack free (оценочный авиа-слой).
- Для каждого провайдера включено fail-safe поведение: ошибка логируется, но не блокирует общий поиск.

## Роли и admin

- Роль хранится в `public.profiles.role` (`user`/`admin`).
- `admin` получает доступ ко всем записям через RLS.
- Для того, чтобы Edge Function работала, нужен как минимум **один admin**.
  - Первый admin обычно назначают вручную в Supabase (SQL Editor):
    ```sql
    update public.profiles set role = 'admin' where id = 'USER_UUID';
    ```

## Edge Function: назначение роли

Файл с функцией: [`supabase/functions/admin-set-role/index.ts`](supabase/functions/admin-set-role/index.ts).

Эндпоинт (как будет называться после деплоя): `POST /functions/v1/admin-set-role`.

Требования:
- В Edge Function settings задайте переменные окружения:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` (service role key)
- Запрос должен быть авторизован админом (JWT в `Authorization: Bearer ...`).
- Body:
  ```json
  { "user_id": "USER_UUID", "role": "admin" }
  ```

## Edge Function: ingestion внешних маршрутов

Файл: [`supabase/functions/ingest-routes/index.ts`](supabase/functions/ingest-routes/index.ts)

Назначение:
- подтянуть маршруты из open-source URL,
- обновить/добавить маршруты в `routes`,
- записать текущую цену в `price_history`.

Необходимые env для функции:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `EXTERNAL_ROUTES_URL`

Пример запуска после деплоя:

```bash
curl -X POST "https://<PROJECT_REF>.functions.supabase.co/ingest-routes"
```

### Пункт 3 (обновлён): деплой `ingest-routes` пошагово

Выполните из корня проекта:

```bash
# 1) Авторизация CLI
npx supabase login

# 2) Привязка к вашему проекту (Project Ref)
npx supabase link --project-ref ixlwzdjmyydazkqeveav

# 3) Установка secrets для функции
npx supabase secrets set SUPABASE_URL=https://ixlwzdjmyydazkqeveav.supabase.co
npx supabase secrets set EXTERNAL_ROUTES_URL=https://open-data-provider.example/routes
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=ваш_service_role_key
npx supabase secrets set INGEST_ROUTES_SECRET=случайная_длинная_строка

# 4) Деплой функции
npx supabase functions deploy ingest-routes

# 5) Ручной запуск (проверка; в заголовке тот же секрет, что в INGEST_ROUTES_SECRET)
curl -X POST "https://ixlwzdjmyydazkqeveav.functions.supabase.co/ingest-routes" \
  -H "x-ingest-secret: случайная_длинная_строка"
```

Если хотите полностью без `curl`, можно вызвать через CLI:

```bash
npx supabase functions invoke ingest-routes
```

## Логирование запросов/ответов провайдеров

- Логи включены в `src/data/providerLogger.js`.
- Для каждого запроса пишутся события:
  - `request` (куда пошли, с какими параметрами),
  - `response` (успех и сколько элементов пришло),
  - `error` (сообщение ошибки и payload).
- Это логирование не прерывает пользовательский сценарий поиска.
