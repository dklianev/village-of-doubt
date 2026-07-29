#!/usr/bin/env sh
set -eu

BACKUP_DIR="${BACKUP_DIR:-/backups}"
BACKUP_MAX_AGE_HOURS="${BACKUP_MAX_AGE_HOURS:-8}"

latest_entry="$(
  find "$BACKUP_DIR" -maxdepth 1 -type f -name 'werewolf_*.sql.gz' -printf '%T@ %p\n' |
    sort -nr |
    head -n 1
)"

if [ -z "$latest_entry" ]; then
  printf 'No PostgreSQL backup found in %s.\n' "$BACKUP_DIR" >&2
  exit 1
fi

latest_backup="${latest_entry#* }"
checksum_file="$latest_backup.sha256"

if [ ! -f "$checksum_file" ]; then
  printf 'Missing checksum for %s.\n' "$latest_backup" >&2
  exit 1
fi

now_epoch="$(date +%s)"
backup_epoch="$(date -r "$latest_backup" +%s)"
age_seconds="$((now_epoch - backup_epoch))"
max_age_seconds="$((BACKUP_MAX_AGE_HOURS * 60 * 60))"

if [ "$age_seconds" -gt "$max_age_seconds" ]; then
  printf 'Latest PostgreSQL backup is %s seconds old; maximum is %s.\n' "$age_seconds" "$max_age_seconds" >&2
  exit 1
fi

gzip -t "$latest_backup"
(cd "$(dirname "$latest_backup")" && sha256sum -c "$(basename "$checksum_file")")

printf 'Backup verified: %s (%s seconds old)\n' "$latest_backup" "$age_seconds"
