-- Опционально: примеры опубликованных маршрутов (после применения schema.sql).
-- Запустите в SQL Editor, если таблица routes пустая.

insert into public.routes (
  title,
  origin_city,
  destination_city,
  price,
  currency,
  status,
  segments
) values
(
  'Москва — Варшава',
  'Москва',
  'Варшава',
  5800,
  'RUB',
  'published',
  '[
    {"from":"Москва","to":"Минск","mode":"train","durationMin":420,"price":3200},
    {"from":"Минск","to":"Варшава","mode":"bus","durationMin":480,"price":2600}
  ]'::jsonb
),
(
  'Санкт-Петербург — Хельсинки',
  'Санкт-Петербург',
  'Хельсинки',
  2900,
  'RUB',
  'published',
  '[
    {"from":"Санкт-Петербург","to":"Хельсинки","mode":"bus","durationMin":480,"price":2900}
  ]'::jsonb
),
(
  'Москва — Гюмри',
  'Москва',
  'Гюмри',
  7400,
  'RUB',
  'published',
  '[
    {"from":"Москва","to":"Минеральные Воды","mode":"plane","durationMin":155,"price":4300},
    {"from":"Минеральные Воды","to":"Гюмри","mode":"bus","durationMin":300,"price":3100}
  ]'::jsonb
);
