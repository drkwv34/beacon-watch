# syntax=docker/dockerfile:1
# One build stage for the whole workspace, one slim runtime target per app:
#   docker build --target api|worker|web .

FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/worker/package.json apps/worker/
COPY apps/web/package.json apps/web/
COPY packages/domain/package.json packages/domain/
COPY packages/db/package.json packages/db/
COPY mock-target/package.json mock-target/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
COPY . .
RUN pnpm build \
  && pnpm --filter @beacon-watch/api deploy --legacy --prod /out/api \
  && pnpm --filter @beacon-watch/worker deploy --legacy --prod /out/worker

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
USER node

FROM runtime AS api
COPY --from=build --chown=node:node /out/api ./
EXPOSE 4000
CMD ["node", "dist/main.js"]

FROM runtime AS worker
COPY --from=build --chown=node:node /out/worker ./
CMD ["node", "dist/main.js"]

FROM runtime AS web
ENV NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
