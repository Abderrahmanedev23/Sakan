# Sakan web image. Build from the repository root:
#   docker build -f apps/web/Dockerfile -t sakan-web .
# The browser calls the API at /api/v1 on the web origin; the Next server forwards those requests
# to API_PROXY_TARGET (fixed at build time) and renders pages against API_INTERNAL_URL (runtime).
FROM node:22-alpine AS build
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter "@sakan/web..."
COPY packages/shared packages/shared
COPY apps/web apps/web
ARG API_PROXY_TARGET=http://api:3001
ENV NEXT_PUBLIC_API_URL=/api/v1 \
    API_PROXY_TARGET=$API_PROXY_TARGET \
    NEXT_OUTPUT_STANDALONE=true
RUN pnpm --filter "@sakan/web..." build

FROM node:22-alpine
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    API_INTERNAL_URL=http://api:3001/api/v1
WORKDIR /app
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=6 \
  CMD wget -qO- http://127.0.0.1:3000/ > /dev/null || exit 1
CMD ["node", "apps/web/server.js"]
