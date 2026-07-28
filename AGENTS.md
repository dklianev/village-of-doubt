# Agent guide — Върколак и Мафия

Този файл се чете от всеки CLI agent (Codex CLI, Claude Code, и др.). Той е **single source of truth** за project conventions. Cross-tool автоматизациите (skills, subagents) препращат към секциите тук — не дублирай знание.

## TL;DR за нов agent

- **Език на UI**: български (Cyrillic). Никакъв англоезичен user-facing text. Системни идентификатори (роли, фази) са на английски в кода, но имат BG label.
- **Commit messages**: английски, кратки и описателни.
- **Authority**: game-server-ът е source of truth. Никаква game logic в client. Тайните роли никога не влизат в синхронизирания state.
- **Преди да push-неш**: `pnpm regression` трябва да минава. Това е contract test suite, не unit tests.

## Стак

| Layer | Choice |
|---|---|
| Monorepo | pnpm 10 + Turbo |
| Frontend | Next.js 16 (App Router, Turbopack) + React 19 + Tailwind 4 |
| Auth | Better Auth 1.6 (email/password + Google OAuth + Discord OAuth) + Drizzle adapter |
| Game server | Colyseus 0.17 (authoritative rooms, schema sync) |
| DB | PostgreSQL 17 + Drizzle 0.45 |
| Validation | t3-env + zod |
| Tests | Vitest 4 + @colyseus/testing |
| Deploy | Docker Compose + Caddy на DigitalOcean |

Версиите са актуални за Q2 2026 — ако пишеш API, **използвай context7 MCP за documentation lookup**, не разчитай на тренировъчни данни.

## Структура

```
apps/
  web/                    Next.js frontend
    app/                  App Router routes
    components/           React клиенти
    lib/                  auth, env, colyseus client, room helpers
  game-server/            Colyseus authoritative server
    src/
      rooms/GameRoom.ts   Главна стая, command handler, фазови преходи
      game-logic/         Pure логика (night-resolver и т.н.)
      persistence/        Drizzle persistence (Noop ако няма DATABASE_URL)
packages/
  shared/                 Роли, presets, протокол, win conditions, signed game tokens
  database/               Drizzle schema + queries (споделен от web и game-server)
scripts/                  Smoke, playtest, regression, env checker, backups
agents-shared/            Cross-CLI workflow guides (за skills / Codex / друго)
.claude/                  Claude Code-specific (skills, agents, settings)
```

## Ключови инварианти (НЕ нарушавай)

1. **Тайните роли не са в `GameState`**. Виж [GameState.ts](apps/game-server/src/rooms/schemas/GameState.ts) — `PlayerPublicState` няма поле `role`. Ролите живеят в `privatePlayers: Map<userId, PrivatePlayerState>` в [GameRoom.ts](apps/game-server/src/rooms/GameRoom.ts) — никога не се синхронизират. Има regression test точно за това: [GameRoom.security.test.ts](apps/game-server/src/__tests__/GameRoom.security.test.ts).

2. **Game-token-ът е HMAC-signed с TTL 5 мин**. Виж [server.ts](packages/shared/src/server.ts). Никога не пропускай verification (`verifyGameToken`). Production-ът отхвърля placeholder secrets с regex `/dev-only|replace|change-me|placeholder/i`.

3. **CORS е deny-by-default в production**. [app.config.ts:43](apps/game-server/src/app.config.ts) хвърля грешка ако `CORS_ORIGIN` или `BETTER_AUTH_URL` липсват. Никога не добавяй wildcard origin.

4. **Целият UI е на български**. Никакъв англ. placeholder, label, error message за крайни user-и. Системни / debug съобщения (console.error, error stack) могат да са на английски.

5. **`publicEvents` и `publicChat` са capped**. 120 / 80 съответно (виж `MAX_PUBLIC_EVENTS` / `MAX_PUBLIC_CHAT` в `apps/game-server/src/rooms/game-room-runtime.ts`). Ако добавяш нов public event source, провери да не го байпасваш.

6. **Random source за role assignment е crypto-based**. Виж `defaultRandomSource` в [role-assignment.ts](packages/shared/src/role-assignment.ts). Не подменяй с `Math.random` освен в детерминистични тестове.

## Команди

| Command | Какво прави |
|---|---|
| `pnpm install` | Install workspace deps |
| `pnpm dev` | Web на :3000 + game-server на :2567 (Turbo persistent) |
| `pnpm typecheck` | TS check на всички 4 пакета |
| `pnpm test` | Vitest suites за shared/game-server/web |
| `pnpm regression` | Contract checks (CSS, security guards, env checker, launch testing и т.н.) |
| `pnpm build` | Production builds |
| `pnpm smoke` | Стартира prod build, проверява всички routes + game-token API |
| `pnpm frontend:e2e` | Playwright QA на production build-а за ключови frontend routes |
| `pnpm e2e:auth` | Auth E2E flows; без локална база може да се пусне с `E2E_LOCAL_ONLY=true` |
| `pnpm playtest` | Multi-client GameRoom regression suite |
| `pnpm visual` | Playwright visual regression срещу baseline screenshots |
| `pnpm visual:ui` | Storybook visual regression за `packages/ui` primitives |
| `pnpm ui:dev` | Storybook dev server за `@werewolf/ui` на :6006 |
| `pnpm ui:build` | Production build на `@werewolf/ui` |
| `pnpm ui:storybook:build` | Static Storybook build |
| `pnpm check:dict` | Audit-only Bulgarian dictionary check; предупреждава, exit 0 |
| `pnpm perf:budget` | Проверява JS/CSS/art asset budgets след build |
| `pnpm verify` | Пълно: optimize:assets → regression → typecheck → build → smoke → frontend:e2e → e2e:auth → playtest → test → visual → perf:budget |
| `pnpm verify:heavy` | `pnpm verify` + migration tests + load test |
| `pnpm check:prod-env` | Валидира production env (HTTPS, secret length, no dev placeholders) |
| `pnpm db:generate` / `pnpm db:migrate` | Drizzle migrations |

**Преди commit**: минимум `pnpm typecheck && pnpm test && pnpm regression`. `.githooks/pre-commit` автоматизира това, ако git hooks path-ът е настроен.

## Env vars

Виж [.env.example](.env.example). Минимум за local:
- `DATABASE_URL=postgres://werewolf:dev@localhost:5432/werewolf`
- `BETTER_AUTH_SECRET` (≥32 chars)
- `GAME_TOKEN_SECRET` (≥32 chars; може да е същият като BETTER_AUTH_SECRET в dev)
- `BETTER_AUTH_URL=http://localhost:3000`
- `NEXT_PUBLIC_APP_URL=http://localhost:3000`
- `NEXT_PUBLIC_GAME_SERVER_URL=ws://localhost:2567`

В production: всички ↑ + `PUBLIC_WEB_DOMAIN`, `PUBLIC_WS_DOMAIN`, `CORS_ORIGIN`, `ALLOW_DEV_AUTH=false` и поне един OAuth provider (`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` или `DISCORD_CLIENT_ID`/`DISCORD_CLIENT_SECRET`). `pnpm check:prod-env` валидира.

## Design system

`packages/ui` държи React-only primitives, tokens и Storybook. Няма Next.js imports в този package; app-level wrappers живеят в `apps/web`.

### Tokens

`--ds-*` OKLCH tokens живеят в `packages/ui/src/tokens.css`. Те са паралелни на legacy `--ink`, `--paper`, `--blood` и не ги заменят масово. Нови primitives четат `--ds-*`; съществуващ CSS остава на legacy tokens до отделна миграция.

Tailwind v4 bridge-ът `@theme { ... }` живее в `apps/web/app/globals.css`, не в `packages/ui`. UI package-ът остава Tailwind-agnostic.

Radii са умишлено стегнати: `--ds-radius-card: 8px`, `--ds-radius-tile: 6px`, `--ds-radius-chip: 999px`.

### Primitives

11 components:
- Surface, Eyebrow, Display, PaperCard, SceneCard, Pill, Medallion — CSS-only
- Toast, Dialog, Sheet — Radix lifecycle + CSS `transform`/`opacity` animations
- EmptyState — CSS-only

Server Components should import CSS-only primitives from `@werewolf/ui/server`.
The root `@werewolf/ui` export includes Radix-backed client primitives.

Runtime animation dependencies are intentionally absent. Проверка:
`rg "motion/react" packages/ui/src/primitives` → няма резултати.

`Dialog` и `Sheet` разчитат на Radix `data-state` за CSS enter/exit lifecycle.
`Sheet` винаги има видимо `title` и включва собствените си layout styles, за да не зависи от consumer CSS import.

### Hero banners

Hero изображенията минават през `SceneCard.background`, не през page-local
`<Image fill>` wrappers и не през `:global()` overrides върху primitives:

```tsx
<SceneCard
  eyebrow="ДОСИЕ"
  density="lg"
  background={{ image: "var(--art-account)", overlay: "scrim" }}
>
  ...
</SceneCard>
```

`background.image` трябва да ползва app-level `--art-*` token, когато има такъв.
Виж `packages/ui/docs/tokens.md` за overlay и focal-point правилата.

### Theme + faction attributes

- `data-theme="light" | "dark"` живее на `<html>` и управлява surface/ink theme.
- `data-faction="werewolves" | "mafia"` живее на page-level container и управлява faction accents.

Новите primitives четат `data-faction` за faction styling. Legacy
`[data-theme="werewolves" | "mafia"]` selectors остават като съвместимост до
отделна cleanup миграция; не добавяй нови faction selectors върху `data-theme`.

### Primitive override guard

CSS modules не трябва да пренаписват primitive identity чрез `:global()`, напр.
`:global(.paper-card)` или `:global([data-ds-scene-card])`. Използвай additive
primitive prop или page-local wrapper accent. `pnpm regression` предупреждава за
нарушения по време на hero restoration и ще стане hard guard след cleanup-а.

### Empty states

22-entry catalog: `packages/ui/src/states/empty-states.ts`. Geometric SVG artifacts: `packages/ui/src/primitives/artifacts/`.

`apps/web/components/ArtifactImage.tsx` е app wrapper. PR 3 версията е SVG-only; optional painterly assets се добавят само при изрична заявка.

### Dictionary

`docs/dictionary.md` е canonical за Bulgarian copy. Run `pnpm check:dict` преди PR. Hard warnings (English in JSX, anglicisms) се оправят; legacy spec deviations като `Постижения` vs `Легенди` са допустими до copy-migration PR.

### Acceptance and Storybook

`docs/acceptance/*.md` съдържа per-page PR checklist.

Storybook 10 (React-Vite) е reference за primitives и MDX docs. `pnpm visual:ui` покрива 11 primitives × light/dark × desktop/mobile и пуска axe върху `#storybook-root`.

## Post-redesign architecture

### Game server modules

`GameRoom.ts` композира отделни managers за най-рисковите lifecycle части:

- `PlayerPresenceManager` — active clients, token nonce replay guard, join rate limit и janitors
- `PhaseStateMachine` — phase timers, pause/resume snapshot и timer cleanup
- `AchievementBroadcaster` — in-memory achievement event buffer, duplicate suppression и targeted unlock grouping
- `RoomPersistenceCoordinator` — persistence queue, backpressure, Sentry capture и no-op fallback без `DATABASE_URL`
- `RoomChatRouter` — public/faction/dead chat routing, typing events и chat caps
- `PrivateEventDispatcher` — private role, lovers и full narrator snapshots
- `game-room-runtime.ts` — shared runtime helpers, room-code utilities, readiness checks и caps

Sacred: `apps/game-server/src/game-logic/night-resolver.ts` и command protocol surface-ът в `GameRoom.ts`.
Всяка промяна там минава през [role-mechanics-review.md](agents-shared/role-mechanics-review.md).

Regression contract-ът нарочно проверява production token secret guard-а в `GameRoom.ts`.
Не мести `getGameTokenSecret` / `isProductionSecret` без едновременно да запазиш или обновиш security guard-а.

### Database

Drizzle relations живеят в `packages/database/src/schema.ts`. Използвай
`db.query.<table>.findMany({ with: { ... } })` за обикновено object loading
и explicit SQL joins за aggregate reports като leaderboard.

Migration workflow:

- След промяна в `schema.ts`: `pnpm --filter @werewolf/database db:generate`
- Commit-вай schema и generated SQL migration заедно
- Production минава през `pnpm --filter @werewolf/database db:migrate`
- Не използвай `db:push` срещу production
- `pnpm regression` пуска `drizzle-kit check --config drizzle.config.ts`

## Workflow guides

Тези markdown файлове в [agents-shared/](agents-shared/) описват често срещани cross-cutting workflows. Skills и subagents препращат към тях — четат се и от Codex CLI и от Claude Code.

- [add-role.md](agents-shared/add-role.md) — добавяне на нова роля (touch-ва 8+ файла)
- [role-mechanics-review.md](agents-shared/role-mechanics-review.md) — checklist преди merge на промяна в game logic
- [bg-copy-review.md](agents-shared/bg-copy-review.md) — гарантира че user-facing text остава на български

## MCP servers

Конфигурирани в [.mcp.json](.mcp.json) (универсалният формат, чете се от Claude Code и Codex CLI):

- **context7** — live documentation за Next 16, Tailwind 4, Better Auth, Colyseus, Drizzle (тренировъчните данни на моделите изостават)
- **postgres** — query/schema на локалната DB; за seed-ване и debug на history page

Codex CLI: ако твоят runtime не чете `.mcp.json` автоматично, добави servers-ите ръчно (`codex mcp add ...`) или сложи в `~/.codex/config.toml`.

## Какво е Claude-specific

`.claude/` папката съдържа неща които само Claude Code разбира — но логиката им е дублирана в `agents-shared/` за да може Codex да следва същите правила:

| Claude-specific | Cross-tool еквивалент |
|---|---|
| `.claude/skills/add-role/SKILL.md` | `agents-shared/add-role.md` |
| `.claude/agents/role-mechanics-reviewer.md` | `agents-shared/role-mechanics-review.md` |
| `.claude/agents/bg-copy-reviewer.md` | `agents-shared/bg-copy-review.md` |
| `.claude/settings.json` Stop hook (`pnpm regression`) | `.githooks/pre-commit` (същото) |

Codex (и всеки друг CLI без skill ecosystem) трябва да чете markdown файла директно и да следва инструкциите.

## Безопасност при писане

- **Никога** не commit-вай `.env*` файлове. `.githooks/pre-commit` ще откаже.
- **Никога** не редактирай `pnpm-lock.yaml` ръчно — само през `pnpm install`.
- **Никога** не push-вай force към `main` без явна заявка.
- Commit messages **без Co-Authored-By** освен ако user-ът изрично не го поиска.
- При нов commit, винаги **нов** commit, не amend (освен по изрична заявка).
