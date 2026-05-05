# Production Checklist За DigitalOcean

## Преди първи deploy

- Създай Droplet във Frankfurt с Ubuntu LTS, Docker и Docker Compose plugin.
- Насочи `A` records: основен домейн към web и `ws.` домейн към същия IP.
- Попълни `.env` от `.env.example` с истински `DB_PASSWORD`, `BETTER_AUTH_SECRET`, `GAME_TOKEN_SECRET`, домейни и OAuth ключове.
- Изпълни `pnpm check:prod-env` с production env променливите.
- Увери се, че `ALLOW_DEV_AUTH=false` или липсва в production.
- Стартирай `docker compose up -d --build`.
- Провери `https://PUBLIC_WEB_DOMAIN` и `wss://PUBLIC_WS_DOMAIN`.

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
- Game server е authoritative source of truth; клиентът не държи чужди роли.
- Системните логове и game events не трябва да съдържат private роли в публични payload-и.
- При public launch добавяме rate limiting, reports, ban/mute и Turnstile при abuse.
