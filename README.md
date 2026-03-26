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

## Переменные окружения

В корне проекта создайте файл `.env` (или скопируйте из примера):

```env
VITE_SUPABASE_URL=https://ВАШ_ПРОЕКТ.supabase.co
VITE_SUPABASE_ANON_KEY=ваш_anon_ключ
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
