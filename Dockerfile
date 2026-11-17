# syntax=docker/dockerfile:1
FROM node:26.12.1-bookworm-slim AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --global npm@11.20.0 --no-audit --no-fund \
    && npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM nginx:1.31.5-alpine AS production

ENV API_UPSTREAM=http://wallpaper-api:8080
COPY docker/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist/ /usr/share/nginx/html/

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
