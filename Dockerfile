FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["/bin/sh", "-c", "if [ -f /usr/share/nginx/html/env-config.template.js ]; then envsubst < /usr/share/nginx/html/env-config.template.js > /usr/share/nginx/html/env-config.js; fi && nginx -g 'daemon off;'"]
