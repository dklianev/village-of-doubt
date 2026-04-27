#!/usr/bin/env sh
set -eu

BACKUP_DIR="${BACKUP_DIR:-/backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
POSTGRES_USER="${POSTGRES_USER:-werewolf}"
POSTGRES_DB="${POSTGRES_DB:-werewolf}"

mkdir -p "$BACKUP_DIR"
backup_file="$BACKUP_DIR/werewolf_$(date +%F_%H-%M-%S).sql.gz"

docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$backup_file"
find "$BACKUP_DIR" -type f -name "werewolf_*.sql.gz" -mtime +"$BACKUP_RETENTION_DAYS" -delete

if [ -n "${RCLONE_REMOTE:-}" ] && command -v rclone >/dev/null 2>&1; then
  rclone copy "$backup_file" "$RCLONE_REMOTE"
fi

printf 'Backup written: %s\n' "$backup_file"
