# Село под съмнение

Българска Werewolf/Mafia web игра с authoritative Colyseus game server, Next.js frontend, Better Auth, Drizzle и PostgreSQL.

## Структура

- `apps/web` - Next.js App Router frontend.
- `apps/game-server` - Colyseus authoritative game server.
- `packages/shared` - роли, presets, протокол, win conditions.
- `packages/database` - Drizzle schema и database client.

## Локален старт

```bash
pnpm install
pnpm build
pnpm dev
```

За Codex Run Action използвай:

```bash
pnpm codex:run
```

Това стартира web на `http://localhost:3000` и Colyseus на `ws://localhost:2567` с local dev defaults за auth/game token-и.

За локална база:

```bash
docker run -d --name werewolf-pg -e POSTGRES_PASSWORD=dev -e POSTGRES_USER=werewolf -e POSTGRES_DB=werewolf -p 5432:5432 postgres:17-alpine
```

Минимален `.env.local` за `apps/web`:

```bash
DATABASE_URL=postgres://werewolf:dev@localhost:5432/werewolf
BETTER_AUTH_SECRET=replace-with-32-plus-random-chars
GAME_TOKEN_SECRET=replace-with-another-32-plus-random-chars
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_GAME_SERVER_URL=ws://localhost:2567
```

Минимален `.env` за game server:

```bash
GAME_SERVER_PORT=2567
ALLOW_DEV_AUTH=true
```

## Проверки

```bash
pnpm test
pnpm typecheck
pnpm optimize:assets
pnpm regression
pnpm build
pnpm smoke
pnpm playtest
pnpm verify
pnpm check:prod-env
```

`pnpm verify` е пълният regression gate: оптимизира assets, проверява project contracts, typecheck-ва, build-ва, стартира standalone smoke, multi-client playtest и всички Vitest тестове.

## MVP статус

Имплементираната основа включва:

- monorepo setup;
- shared role presets, manual role validation и win conditions;
- Drizzle schema;
- Better Auth route handler;
- Colyseus authoritative room с private role events, faction/dead chat, reconnect identity и narrator controls;
- роли за Мафия и Върколаци: Комисар, Дон, Върколак, Ясновидка, Вещица, Лечител, Свещеник, Ловец, Купидон, Вампир, Шут и Крадец;
- Next.js екрани за landing, lobby, play и history timeline;
- Docker Compose + Caddy deploy основа;
- production env checker, backup/restore scripts, smoke и multi-client playtest suite.

Следващите големи стъпки са реални playtest-и с приятели, browser/e2e автоматизация в CI и public launch hardening като rate limiting, reports, bans и Turnstile при abuse.
