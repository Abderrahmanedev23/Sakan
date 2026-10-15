# Sakan API image. Build from the repository root:
#   docker build -f apps/api/Dockerfile -t sakan-api .
FROM node:22-alpine AS build
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter "@sakan/api..."
COPY packages/shared packages/shared
COPY apps/api apps/api
# prisma generate reads the config, which needs a DATABASE_URL; nothing connects during the build.
RUN DATABASE_URL=mysql://build:build@localhost:3306/build pnpm --filter "@sakan/api..." build

FROM node:22-alpine
ENV NODE_ENV=production \
    PORT=3001 \
    STORAGE_DRIVER=local \
    PRIVATE_STORAGE_DIR=/data/private
WORKDIR /app
# The whole built workspace: the Prisma CLI (migrations) and the seed script come with it.
COPY --from=build /app /app
COPY apps/api/docker-entrypoint.sh /usr/local/bin/sakan-api-entrypoint
RUN chmod +x /usr/local/bin/sakan-api-entrypoint && mkdir -p /data/private && chown -R node:node /data
USER node
WORKDIR /app/apps/api
VOLUME /data
EXPOSE 3001
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=6 \
  CMD wget -qO- http://127.0.0.1:3001/api/v1/health > /dev/null || exit 1
ENTRYPOINT ["sakan-api-entrypoint"]
CMD ["node", "dist/main.js"]
