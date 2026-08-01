FROM node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2 AS base
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
