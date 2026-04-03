# Финальный образ — Alpine + nginx (apk), а не официальный nginx:*.
# Amvera подменяет ENTRYPOINT у образов nginx:* и запускает голый nginx — из-за этого
# не выполнялся docker-entrypoint.sh (Метрика, envsubst).

FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_YANDEX_METRIKA_ID=
ENV VITE_YANDEX_METRIKA_ID=$VITE_YANDEX_METRIKA_ID

RUN npm run build

FROM alpine:3.20

RUN apk add --no-cache nginx gettext \
  && mkdir -p /run/nginx \
  && ln -sf /dev/stderr /var/log/nginx/error.log \
  && ln -sf /dev/stdout /var/log/nginx/access.log

COPY nginx.conf /etc/nginx/http.d/default.conf
COPY scripts/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

ENTRYPOINT ["/docker-entrypoint.sh"]
