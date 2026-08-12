# Production Checklist За DigitalOcean

## Преди първи deploy

- Създай Droplet във Frankfurt с Ubuntu LTS, Docker и Docker Compose plugin.
- Насочи `A` records: `senkite.com` към web и `ws.senkite.com` към същия IP.
- Попълни `.env` от `.env.example` с истински `DB_PASSWORD`, `BETTER_AUTH_SECRET`, `GAME_TOKEN_SECRET`, OAuth ключове и production URL-и:
  - `PUBLIC_WEB_DOMAIN=senkite.com`
  - `PUBLIC_WS_DOMAIN=ws.senkite.com`
  - `BETTER_AUTH_URL=https://senkite.com`
  - `NEXT_PUBLIC_APP_URL=https://senkite.com`
  - `CORS_ORIGIN=https://senkite.com`
- Изпълни `pnpm check:prod-env` с production env променливите.
- Изтегли `release.json` и `release.json.sig` от trusted GitHub Actions artifact. Провери, че production host-ът има root-owned Ed25519 public key и точен `RELEASE_ALLOWED_IMAGE_PREFIX`; не build-вай application images на production хоста.
- Release-ът се показва в `/api/health` и се изпраща към server/edge/browser Sentry без лични данни.
- Увери се, че `ALLOW_DEV_AUTH=false` или липсва в production.
- Изпълни `scripts/deploy-release.sh /var/lib/werewolf/releases/candidate.json` от root-owned checkout-а с `RELEASE_STATE_DIR=/var/lib/werewolf/release-state`, както е описано в `docs/operations/production-runbook.md`.
- Провери `https://senkite.com` и `wss://ws.senkite.com`.

## Планиран Deploy И Drain

- Изпълни canonical immutable-checkout командата от `docs/operations/production-runbook.md` с `/var/lib/werewolf/releases/candidate.json`. Тя първо активира loopback-only drain, изчаква активните стаи, стартира hardened backup unit-а, после pull-ва digest-pinned images и пуска миграцията.
- По време на drain статистиката се чете само през `docker compose exec` от loopback `/operations/stats`. Няма публичен operational stats endpoint. Нови стаи не се създават, а текущите връзки продължават да работят.
- Скриптът има bounded timeout (`DEPLOY_DRAIN_TIMEOUT_MS`, по подразбиране 20 минути). При timeout излиза с грешка и оставя стария container да работи; не продължавай deploy-а насила.
- При неуспешен backup, pull, migration или readiness check release-ът спира; не заобикаляй стъпката със `SKIP_DEPLOY_BACKUP=1`, освен при документиран incident.
- Непланиран `SIGTERM` също спира matchmaking-а и чака до `GAME_DRAIN_TIMEOUT_MS` (по подразбиране 120 секунди) преди bounded shutdown. Compose дава 130 секунди stop grace period.
- След deploy провери `/api/health` за web liveness, `/api/health/ready` за web плюс DB/game зависимости и `https://ws.senkite.com/health/ready` за game persistence. Web liveness остава 200, когато само game service е недостъпен; това пази публичните страници и показва повредата в `/status`.
- При спешен rollback използвай предишния immutable release manifest само ако schema-та остава backward-compatible. Не пипай Postgres volume и не пускай миграции назад без rehearsed restore.

## Backup И Restore

- Инсталирай root-owned systemd backup timer-а от `docs/operations/production-runbook.md`; не давай Docker group на `werewolf` акаунта.
- Настрой `BACKUP_AGE_RECIPIENT` задължително и `RCLONE_REMOTE` за копие извън Droplet-а. Пази private age identity извън production host-а.
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
