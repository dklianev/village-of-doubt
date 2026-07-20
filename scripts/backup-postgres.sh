#!/usr/bin/env sh
set -eu

BACKUP_DIR="${BACKUP_DIR:-/backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
POSTGRES_USER="${POSTGRES_USER:-werewolf}"
POSTGRES_DB="${POSTGRES_DB:-werewolf}"

mkdir -p "$BACKUP_DIR"
backup_file="$BACKUP_DIR/werewolf_$(date +%F_%H-%M-%S).sql.gz"
temporary_sql="$(mktemp "$BACKUP_DIR/.werewolf_dump.XXXXXX.sql")"
temporary_gzip="$backup_file.tmp"

cleanup() {
  rm -f "$temporary_sql" "$temporary_gzip"
}
trap cleanup EXIT HUP INT TERM

docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > "$temporary_sql"
test -s "$temporary_sql"
gzip -c "$temporary_sql" > "$temporary_gzip"
gzip -t "$temporary_gzip"
mv "$temporary_gzip" "$backup_file"
(cd "$(dirname "$backup_file")" && sha256sum "$(basename "$backup_file")" > "$(basename "$backup_file").sha256")
find "$BACKUP_DIR" -type f \( -name "werewolf_*.sql.gz" -o -name "werewolf_*.sql.gz.sha256" \) -mtime +"$BACKUP_RETENTION_DAYS" -delete

if [ -n "${RCLONE_REMOTE:-}" ]; then
  if ! command -v rclone >/dev/null 2>&1; then
    printf 'RCLONE_REMOTE is set, but rclone is unavailable.\n' >&2
    exit 1
  fi
  rclone copy "$backup_file" "$RCLONE_REMOTE"
  rclone copy "$backup_file.sha256" "$RCLONE_REMOTE"
fi

printf 'Backup written: %s\n' "$backup_file"
