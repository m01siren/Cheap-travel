#!/bin/sh
set -e
HTML_DIR=/usr/share/nginx/html
cd "$HTML_DIR"

# Только цифры — безопасно для подстановки в sed
METRIKA_ID=$(printf '%s' "${VITE_YANDEX_METRIKA_ID:-}" | tr -cd '0-9')

# В логах Amvera: «Просмотр логов» — видно, видит ли контейнер переменную «Запуск»
echo "[docker-entrypoint] AMVERA=${AMVERA:-} VITE_YANDEX_METRIKA_ID length=${#VITE_YANDEX_METRIKA_ID} digits=${METRIKA_ID:-empty}" >&2

if [ -f env-config.template.js ]; then
  envsubst < env-config.template.js > env-config.js
fi

# envsubst оставил пустую строку, а на «Запуск» ID задан — подставляем
if [ -n "$METRIKA_ID" ] && [ -f env-config.js ]; then
  sed -i "s/VITE_YANDEX_METRIKA_ID: \"\"/VITE_YANDEX_METRIKA_ID: \"${METRIKA_ID}\"/" env-config.js
fi

# Старый образ без поля в шаблоне: дописываем из переменной этапа «Запуск» (Amvera)
if [ -n "$METRIKA_ID" ] && [ -f env-config.js ] && ! grep -q 'VITE_YANDEX_METRIKA_ID' env-config.js; then
  awk -v id="$METRIKA_ID" '
    { lines[NR] = $0 }
    END {
      for (i = 1; i < NR; i++) print lines[i]
      if (lines[NR] ~ /^};$/) print "  VITE_YANDEX_METRIKA_ID: \"" id "\","
      print lines[NR]
    }
  ' env-config.js > env-config.js.tmp && mv env-config.js.tmp env-config.js
fi

# index.html без meta или с пустым content="" — подставляем ID с этапа «Запуск»
if [ -n "$METRIKA_ID" ] && [ -f index.html ]; then
  if ! grep -q 'yandex-metrika-counter' index.html; then
    sed -i "s|<head>|<head>\n    <meta name=\"yandex-metrika-counter\" content=\"${METRIKA_ID}\" />|" index.html
  elif grep -q 'name="yandex-metrika-counter" content=""' index.html; then
    sed -i "s/name=\"yandex-metrika-counter\" content=\"\"/name=\"yandex-metrika-counter\" content=\"${METRIKA_ID}\"/" index.html
  fi
fi

exec nginx -g 'daemon off;'
