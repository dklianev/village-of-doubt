# Production Checklist За Hetzner

## Преди първи deploy

- Създай Hetzner Cloud сървър в избрана европейска локация с Ubuntu LTS, Docker и Docker Compose plugin.
- Насочи `A` records: `senkite.com` към web и `ws.senkite.com` към същия IP.
- Разреши TCP `80/443` и UDP `443` във firewall-а. UDP портът активира HTTP/3; при блокиран UDP Caddy продължава през HTTP/2.
- Попълни `.env` от `.env.example` с истински `DB_PASSWORD`, `BETTER_AUTH_SECRET`, `GAME_TOKEN_SECRET`, OAuth ключове и production URL-и:
  - `PUBLIC_WEB_DOMAIN=senkite.com`
  - `PUBLIC_WS_DOMAIN=ws.senkite.com`
  - `BETTER_AUTH_URL=https://senkite.com`
  - `NEXT_PUBLIC_APP_URL=https://senkite.com`
  - `CORS_ORIGIN=https://senkite.com`
- Конфигурирай и двата OAuth провайдъра (Google и Discord), защото и двата бутона се показват в екрана за вход. Задай и валиден `REPORTS_NOTIFY_EMAIL`; production env проверката отказва deploy без получател за сигналите.
- Изпълни `pnpm check:prod-env` с production env променливите.
- Изтегли `release.json` и `release.json.sig` от trusted GitHub Actions artifact. Провери, че production host-ът има root-owned Ed25519 public key и точен `RELEASE_ALLOWED_IMAGE_PREFIX`; не build-вай application images на production хоста.
- Release-ът се показва в `/api/health` и се изпраща към server/edge/browser Sentry без лични данни.
- Увери се, че `ALLOW_DEV_AUTH=false` или липсва в production.
- Изпълни `scripts/deploy-release.sh /var/lib/werewolf/releases/candidate.json` от root-owned checkout-а с `RELEASE_STATE_DIR=/var/lib/werewolf/release-state`, както е описано в `docs/operations/production-runbook.md`.
- Провери `https://senkite.com` и `wss://ws.senkite.com`.

## Планиран Deploy И Drain

- Изпълни canonical immutable-checkout командата от `docs/operations/production-runbook.md` с `/var/lib/werewolf/releases/candidate.json`. Тя първо активира loopback-only drain, изчаква активните стаи, стартира hardened backup unit-а, после pull-ва digest-pinned images и пуска миграцията.
- По време на drain статистиката се чете само през `docker compose exec` от loopback `/operations/stats`. Няма публичен operational stats endpoint. Нови стаи не се създават, а текущите връзки продължават да работят.
- Single-host release-ът е контролиран restart, не zero-downtime deploy: след като активните стаи приключат, нови сесии остават временно спрени до успешния health gate на новите контейнери. Планирай и обявявай кратък maintenance прозорец.
- Скриптът има bounded timeout (`DEPLOY_DRAIN_TIMEOUT_MS`, по подразбиране 20 минути). При timeout излиза с грешка и оставя стария container да работи; не продължавай deploy-а насила.
- Dependency startup-ът е ограничен от `COMPOSE_WAIT_TIMEOUT_SECONDS`. Migrator-ът има отделни `MIGRATION_LOCK_TIMEOUT_MS`, `MIGRATION_STATEMENT_TIMEOUT_MS`, `MIGRATION_IDLE_TRANSACTION_TIMEOUT_MS` и host process timeout. Не увеличавай process timeout-а без измерване и maintenance прозорец.
- Deploy, rollback, restore и restore acceptance ползват един host lock в `release-state/operations.lock`. Не трий lock директорията, преди да провериш записания PID и състоянието на базата.
- Преди миграция се записва подписан `migration-pending.json`; след успех се обновява `schema-current.json`. Pending marker или различен migration head блокира автоматичния rollback с `MAINTENANCE REQUIRED`.
- При неуспешен backup, pull, migration или readiness check release-ът спира; не заобикаляй стъпката със `SKIP_DEPLOY_BACKUP=1`, освен при документиран incident.
- Непланиран `SIGTERM` също спира matchmaking-а и чака до `GAME_DRAIN_TIMEOUT_MS` (по подразбиране 120 секунди) преди bounded shutdown. Compose дава 260 секунди stop grace period: 120 секунди drain, до 110 секунди terminal persistence, по 5 секунди за Redis/DB и малък резерв.
- Ако deploy/rollback се провали преди старият game контейнер да бъде заменен, drain режимът се отменя автоматично. При необработен срив fail-safe срокът `GAME_DEPLOY_DRAIN_MAX_AGE_MS` възстановява matchmaking-а след един час. При ръчно възстановяване използвай `pnpm deploy:cancel-drain` само на хоста с достъп до Docker.
- След deploy провери `/api/health` за web liveness, публичния HTTPS `/api/health/ready`, `https://ws.senkite.com/health/ready` и реален WSS upgrade с origin `https://senkite.com`. Release скриптът изисква Caddy marker-и и за двата hostname-а, не приема само вътрешно зелени контейнери. Web liveness остава 200, когато само game service е недостъпен; това пази публичните страници и показва повредата в `/status`.
- При спешен rollback използвай предишния immutable release manifest само ако schema-та остава backward-compatible. Не пипай Postgres volume и не пускай миграции назад без rehearsed restore.

## Backup И Restore

- Инсталирай root-owned systemd backup timer-а от `docs/operations/production-runbook.md`; не давай Docker group на `werewolf` акаунта.
- Настрой `BACKUP_AGE_RECIPIENT`, явен непривилегирован префикс в `RCLONE_REMOTE`, отделен профил и префикс в `RCLONE_DELETION_LEDGER_REMOTE` и `RCLONE_BACKUP_RETENTION_DAYS=30`. Пази частната age самоличност извън production хоста.
- Дръж основната архивна кофа без управление на версии и с правило за жизнения цикъл на Hetzner, ограничено до архивния префикс и окончателно изтриване след 30 дни. Дръж кофата за регистъра на изтриванията отделна, непублична, защитена и с управление на версии; служебният достъп за архивиране няма право да изтрива обекти от нея, а правилото за жизнения цикъл премахва само старите версии след 30 дни и никога текущия регистър.
- Изпълни `backup-postgres.sh --retention-dry-run` по точната команда от runbook-а и провери, че показва само архивния префикс, никога регистъра на изтриванията.
- Поне веднъж преди сериозна игра направи пробно възстановяване със `scripts/restore-postgres.sh` върху тестова база и подай последния защитен регистър чрез `RESTORE_DELETION_LEDGER_FILE`.
- Възстановяването валидира подписания манифест на активната версия и ползва само посочените в него чрез digest образи за миграции, web и game. Пази оригиналната база след превключването, валидира връзките между досиета и история, правата при изпълнение и обединените външни и текущи маркери за изтриване, пресъздава Caddy и проверява вътрешния и публичния вход. Изтрий копието за връщане назад само с отпечатаната команда `sh scripts/restore-accept.sh` след реални проверки на досие, история и целия път от създаване до игра.
- Запази последните 14 дни локално или промени `BACKUP_RETENTION_DAYS`.
- Запиши като изрично остатъчно ограничение, че външният регистър на изтриванията има шестчасова цел за точка на възстановяване (RPO) и не е синхронен журнал.

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
