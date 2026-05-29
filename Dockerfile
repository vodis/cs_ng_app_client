# syntax=docker/dockerfile:1

FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN --mount=type=secret,id=npm_token \
    sh -c 'set -e; \
      NPM_TOKEN=$(tr -d "\n\r" </run/secrets/npm_token); \
      [ -n "$NPM_TOKEN" ] || (echo "BuildKit secret npm_token is required for @vodis packages" >&2; exit 1); \
      printf "%s\n" "@vodis:registry=https://npm.pkg.github.com/" "//npm.pkg.github.com/:_authToken=${NPM_TOKEN}" > .npmrc; \
      pnpm install --frozen-lockfile; \
      rm -f .npmrc'

FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN pnpm run build-prod

FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist/cs_ng_app_client /usr/share/nginx/html

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health >/dev/null || exit 1
