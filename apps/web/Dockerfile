FROM node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2 AS base
WORKDIR /app
RUN corepack enable

FROM base AS migrator-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages/database/package.json packages/database/package.json
RUN pnpm install --frozen-lockfile --filter @werewolf/database...

FROM migrator-deps AS migrator
COPY packages/database packages/database
WORKDIR /app/packages/database
USER node
CMD ["./node_modules/.bin/drizzle-kit", "migrate", "--config", "drizzle.config.ts"]

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS builder
ARG NEXT_PUBLIC_APP_URL=https://localhost
ARG NEXT_PUBLIC_GAME_SERVER_URL=wss://localhost
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ENV NEXT_PUBLIC_GAME_SERVER_URL=${NEXT_PUBLIC_GAME_SERVER_URL}
COPY . .
RUN pnpm --filter @werewolf/shared build
RUN pnpm --filter @werewolf/database build
RUN pnpm --filter @werewolf/ui build
RUN --mount=type=secret,id=better_auth_secret \
    --mount=type=secret,id=game_token_secret \
    BETTER_AUTH_SECRET="$(cat /run/secrets/better_auth_secret)" \
    GAME_TOKEN_SECRET="$(cat /run/secrets/game_token_secret)" \
    pnpm --filter @werewolf/web build

FROM base AS runner
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
COPY --from=builder --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=builder --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=node:node /app/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
