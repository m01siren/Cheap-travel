FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# ID Метрики в бандл и в <meta> (задайте в Amvera в параметрах сборки / docker build --build-arg)
ARG VITE_YANDEX_METRIKA_ID=
ENV VITE_YANDEX_METRIKA_ID=$VITE_YANDEX_METRIKA_ID

RUN npm run build

FROM nginx:1.27-alpine
RUN apk add --no-cache gettext
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY scripts/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
ENTRYPOINT ["/docker-entrypoint.sh"]
