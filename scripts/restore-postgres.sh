#!/usr/bin/env sh
set -eu

if [ $# -ne 1 ]; then
  printf 'Usage: %s /path/to/werewolf_YYYY-MM-DD_HH-MM-SS.sql.gz\n' "$0" >&2
  exit 1
fi

backup_file="$1"
POSTGRES_USER="${POSTGRES_USER:-werewolf}"
POSTGRES_DB="${POSTGRES_DB:-werewolf}"

if [ ! -f "$backup_file" ]; then
  printf 'Backup file not found: %s\n' "$backup_file" >&2
  exit 1
fi

printf 'Restoring %s into database %s...\n' "$backup_file" "$POSTGRES_DB"
gzip -dc "$backup_file" | docker compose exec -T postgres psql -U "$POSTGRES_USER" "$POSTGRES_DB"
printf 'Restore completed.\n'
