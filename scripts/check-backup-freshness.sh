#!/usr/bin/env sh
set -eu

BACKUP_DIR="${BACKUP_DIR:-/backups}"
BACKUP_MAX_AGE_HOURS="${BACKUP_MAX_AGE_HOURS:-8}"
BACKUP_CLOCK_SKEW_SECONDS="${BACKUP_CLOCK_SKEW_SECONDS:-300}"

case "$BACKUP_MAX_AGE_HOURS" in
  ""|*[!0-9]*)
    printf 'BACKUP_MAX_AGE_HOURS must be a non-negative integer.\n' >&2
    exit 1
    ;;
esac

case "$BACKUP_CLOCK_SKEW_SECONDS" in
  ""|*[!0-9]*)
    printf 'BACKUP_CLOCK_SKEW_SECONDS must be a non-negative integer.\n' >&2
    exit 1
    ;;
esac

latest_backup="$(
  find "$BACKUP_DIR" -maxdepth 1 -type f -name 'werewolf_*.sql.gz' |
    sort -r |
    head -n 1
)"

if [ -z "$latest_backup" ]; then
  printf 'No PostgreSQL backup found in %s.\n' "$BACKUP_DIR" >&2
  exit 1
fi

checksum_file="$latest_backup.sha256"

if [ ! -f "$checksum_file" ]; then
  printf 'Missing checksum for %s.\n' "$latest_backup" >&2
  exit 1
fi

now_epoch="$(date +%s)"
backup_epoch="$(date -r "$latest_backup" +%s)"
age_seconds="$((now_epoch - backup_epoch))"
max_age_seconds="$((BACKUP_MAX_AGE_HOURS * 60 * 60))"
minimum_age_seconds="$((-1 * BACKUP_CLOCK_SKEW_SECONDS))"

if [ "$age_seconds" -lt "$minimum_age_seconds" ]; then
  printf 'Latest PostgreSQL backup timestamp is in the future by %s seconds; allowed clock skew is %s.\n' \
    "$((-1 * age_seconds))" "$BACKUP_CLOCK_SKEW_SECONDS" >&2
  exit 1
fi

if [ "$age_seconds" -gt "$max_age_seconds" ]; then
  printf 'Latest PostgreSQL backup is %s seconds old; maximum is %s.\n' "$age_seconds" "$max_age_seconds" >&2
  exit 1
fi

gzip -t "$latest_backup"
(cd "$(dirname "$latest_backup")" && sha256sum -c "$(basename "$checksum_file")")

printf 'Backup verified: %s (%s seconds old)\n' "$latest_backup" "$age_seconds"
