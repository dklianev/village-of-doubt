FROM node:24.20.0-alpine@sha256:e67514e5d0f6c46656005e1b693b2ec9d52e80b641307de684d4a015ba7a4eaf AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY patches patches
COPY apps/game-server/package.json apps/game-server/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/database/package.json packages/database/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS builder
COPY . .
RUN pnpm --filter @werewolf/shared build
RUN pnpm --filter @werewolf/database build
RUN pnpm --filter @werewolf/game-server build
RUN pnpm --filter @werewolf/game-server --prod deploy /prod/game-server

FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder --chown=node:node /prod/game-server ./
USER node
EXPOSE 2567
CMD ["node", "dist/index.js"]
