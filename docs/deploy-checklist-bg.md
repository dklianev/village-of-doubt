# Production Checklist За DigitalOcean

## Преди първи deploy

- Създай Droplet във Frankfurt с Ubuntu LTS, Docker и Docker Compose plugin.
- Насочи `A` records: `tisi.lol` към web и `ws.tisi.lol` към същия IP.
- Попълни `.env` от `.env.example` с истински `DB_PASSWORD`, `BETTER_AUTH_SECRET`, `GAME_TOKEN_SECRET`, OAuth ключове и production URL-и:
  - `PUBLIC_WEB_DOMAIN=tisi.lol`
  - `PUBLIC_WS_DOMAIN=ws.tisi.lol`
  - `BETTER_AUTH_URL=https://tisi.lol`
  - `NEXT_PUBLIC_APP_URL=https://tisi.lol`
  - `CORS_ORIGIN=https://tisi.lol`
- Изпълни `pnpm check:prod-env` с production env променливите.
- Задай `RELEASE_VERSION` на immutable release identifier (например git SHA или release tag). Placeholder стойности като `unknown`, `latest` и `main` спират env проверката. Release-ът се показва в `/api/health` и се изпраща към server/edge Sentry без лични данни; client Sentry DSN не се използва.
- Увери се, че `ALLOW_DEV_AUTH=false` или липсва в production.
- Стартирай `docker compose up -d --build`.
- Провери `https://tisi.lol` и `wss://ws.tisi.lol`.

## Планиран Deploy И Drain

- Изпълни `pnpm deploy:drain`. Скриптът активира loopback-only operator endpoint чрез `docker compose exec`; новите room creations се отказват, а join/reconnect към съществуващи стаи остават разрешени. След това скриптът следи `https://ws.tisi.lol/stats` до `activeRooms=0`.
- По време на drain публичният `/stats` връща само `draining`, `drainStartedAt`, `activeRooms` и `connectedPlayers`. Runtime memory/event-loop данните са само на loopback `/operations/stats`. Нови стаи не се създават, а текущите връзки продължават да работят.
- Скриптът има bounded timeout (`DEPLOY_DRAIN_TIMEOUT_MS`, по подразбиране 20 минути). При timeout излиза с грешка и оставя стария container да работи; не продължавай deploy-а насила.
- Едва след успешен drain изпълни `docker compose up -d --build`. Използвай `pnpm deploy:drain && docker compose up -d --build`, за да не може втората команда да тръгне след неуспешен drain.
- Непланиран `SIGTERM` също спира matchmaking-а и чака до `GAME_DRAIN_TIMEOUT_MS` (по подразбиране 120 секунди) преди bounded shutdown. Compose дава 130 секунди stop grace period.
- След deploy провери `/api/health` за web liveness, `/api/health/ready` за web плюс DB/game зависимости и `https://ws.tisi.lol/health/ready` за game persistence. Web liveness остава 200, когато само game service е недостъпен; това пази публичните страници и показва повредата в `/status`.
- При спешен rollback първо върни web и Caddy, после game image-а. Не пипай Postgres volume и не пускай миграции назад без rehearsed restore.

## Backup И Restore

- Сложи cron за `scripts/backup-postgres.sh` поне веднъж дневно.
- Настрой `RCLONE_REMOTE`, ако искаш копие извън Droplet-а.
- Поне веднъж преди сериозна игра направи restore rehearsal със `scripts/restore-postgres.sh` върху тестова база.
- Запази последните 14 дни локално или промени `BACKUP_RETENTION_DAYS`.

## Smoke Проверки След Deploy

- Отвори landing страницата.
- Създай стая и провери дали лобито показва код.
- Отвори същия код в два браузъра/профила и провери join/ready.
- Стартирай кратка игра с preset и виж дали role reveal се появява само на съответния играч.
- Прекъсни интернет/затвори таб и провери reconnect UX.
- След финал отвори `/history` и провери winner, deaths, votes и phase timeline.

## Неща, Които Не Пропускаме

- Postgres няма публичен порт.
- Caddy управлява HTTPS и WebSocket reverse proxy.
- Docker healthcheck-ът на web проверява само `/api/health`; deep readiness е за операторска диагностика, не за изваждане на сайта от ingress.
- Caddy проверява game transport-а през shallow `/health`. `/health/ready` остава DB diagnostic; кешираният му резултат блокира само ново `GameRoom.onCreate`, докато съществуващи joins, reconnect reservations и WebSocket-и остават на живия процес. Gate-ът опреснява DB състоянието през 5 секунди, така че има кратък bounded прозорец преди новите creations да бъдат спрени при внезапна DB повреда.
- Caddy access логовете пазят само URL path и премахват целия query string, за да не записват reset/OAuth token-и.
- Game server е authoritative source of truth; клиентът не държи чужди роли.
- Системните логове и game events не трябва да съдържат private роли в публични payload-и.
- При public launch добавяме rate limiting, reports, ban/mute и Turnstile при abuse.
