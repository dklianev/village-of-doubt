#!/usr/bin/env sh
set -eu

if [ $# -ne 1 ]; then
  printf 'Usage: %s /path/to/werewolf_YYYY-MM-DD_HH-MM-SS.sql.gz[.age]\n' "$0" >&2
  exit 1
fi

backup_file="$1"
POSTGRES_USER="${POSTGRES_USER:-werewolf}"
POSTGRES_DB="${POSTGRES_DB:-werewolf}"
restore_confirmation="${RESTORE_CONFIRM_DATABASE:-}"
docker_command="${RESTORE_DOCKER_COMMAND:-docker}"
restore_run_id="${RESTORE_RUN_ID:-$$}"
restore_health_timeout="${RESTORE_HEALTH_TIMEOUT_SECONDS:-180}"
restore_only="${RESTORE_ONLY:-0}"
age_command="${BACKUP_AGE_COMMAND:-age}"
age_identity_file="${BACKUP_AGE_IDENTITY_FILE:-}"

if [ ! -f "$backup_file" ]; then
  printf 'Backup file not found: %s\n' "$backup_file" >&2
  exit 1
fi

if [ "$restore_confirmation" != "$POSTGRES_DB" ]; then
  printf 'Set RESTORE_CONFIRM_DATABASE=%s to confirm this destructive restore.\n' "$POSTGRES_DB" >&2
  exit 1
fi

case "$restore_run_id" in
  *[!A-Za-z0-9_-]*)
    printf 'RESTORE_RUN_ID may contain only letters, numbers, underscores, and hyphens.\n' >&2
    exit 1
    ;;
esac

case "$restore_health_timeout" in
  ""|*[!0-9]*|0)
    printf 'RESTORE_HEALTH_TIMEOUT_SECONDS must be a positive integer.\n' >&2
    exit 1
    ;;
esac

case "$restore_only" in
  0|1) ;;
  *)
    printf 'RESTORE_ONLY must be 0 or 1.\n' >&2
    exit 1
    ;;
esac

if [ -z "${MIGRATION_DATABASE_URL:-}" ]; then
  printf 'MIGRATION_DATABASE_URL is required to migrate the staging database.\n' >&2
  exit 1
fi

database_url_without_query="${MIGRATION_DATABASE_URL%%\?*}"
database_url_query=""
case "$MIGRATION_DATABASE_URL" in
  *\?*) database_url_query="?${MIGRATION_DATABASE_URL#*\?}" ;;
esac
configured_database="${database_url_without_query##*/}"
if [ "$configured_database" != "$POSTGRES_DB" ]; then
  printf 'MIGRATION_DATABASE_URL must target POSTGRES_DB=%s before restore.\n' "$POSTGRES_DB" >&2
  exit 1
fi

staging_db="${POSTGRES_DB}_restore_stage_${restore_run_id}"
rollback_db="${POSTGRES_DB}_restore_rollback_${restore_run_id}"
if [ "${#staging_db}" -gt 63 ] || [ "${#rollback_db}" -gt 63 ]; then
  printf 'Temporary restore database names exceed PostgreSQL identifier limits.\n' >&2
  exit 1
fi
staging_database_url="${database_url_without_query%/*}/${staging_db}${database_url_query}"

compose() {
  "$docker_command" compose "$@"
}

quote_ident() {
  printf '"%s"' "$(printf '%s' "$1" | sed 's/"/""/g')"
}

rename_database() {
  source_database="$1"
  destination_database="$2"
  compose exec -T postgres psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres -c \
    "ALTER DATABASE $(quote_ident "$source_database") RENAME TO $(quote_ident "$destination_database");"
}

drop_database() {
  compose exec -T postgres dropdb --if-exists --force -U "$POSTGRES_USER" "$1"
}

terminate_database_sessions() {
  compose exec -T postgres psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres \
    -v database_name="$1" -c "
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = :'database_name'
        AND pid <> pg_backend_pid();
    "
}

validate_staging_database() {
  validation_result="$(
    compose exec -T postgres psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$staging_db" -Atqc "
      SELECT CASE
        WHEN to_regclass('public.user') IS NOT NULL
          AND to_regclass('public.games') IS NOT NULL
          AND to_regclass('public.deleted_user_identities') IS NOT NULL
          AND to_regclass('drizzle.__drizzle_migrations') IS NOT NULL
        THEN 'ok'
        ELSE 'invalid'
      END;
    "
  )"
  test "$validation_result" = "ok"
}

temporary_sql="$(mktemp "${TMPDIR:-/tmp}/werewolf_restore.XXXXXX")"
temporary_gzip="$(mktemp "${TMPDIR:-/tmp}/werewolf_restore.XXXXXX.gz")"
writers_stopped=0
restart_attempted=0
switch_started=0
target_available=1
rollback_available=0
staging_cleanup_safe=1
writers_to_restart=""

cleanup() {
  exit_code=$?
  trap - EXIT HUP INT TERM
  rm -f "$temporary_sql" "$temporary_gzip"

  if [ "$exit_code" -ne 0 ] && [ "$rollback_available" -eq 1 ]; then
    compose stop web game >/dev/null 2>&1 || true
    writers_stopped=1

    if [ "$target_available" -eq 1 ]; then
      terminate_database_sessions "$POSTGRES_DB" >/dev/null 2>&1 || true
      if rename_database "$POSTGRES_DB" "$staging_db" >/dev/null 2>&1; then
        target_available=0
        staging_cleanup_safe=0
      else
        staging_cleanup_safe=0
        printf 'CRITICAL: failed restored database remains at %s; rollback copy is preserved as %s. Writers remain stopped.\n' "$POSTGRES_DB" "$rollback_db" >&2
      fi
    fi

    if [ "$target_available" -eq 0 ]; then
      if rename_database "$rollback_db" "$POSTGRES_DB" >/dev/null 2>&1; then
        rollback_available=0
        target_available=1
        printf 'Restore failed; original database was restored from %s.\n' "$rollback_db" >&2
      else
        staging_cleanup_safe=0
        printf 'CRITICAL: automatic rollback failed; valid copies are preserved as %s and %s. Writers remain stopped.\n' "$staging_db" "$rollback_db" >&2
      fi
    fi
  fi

  if [ "$staging_cleanup_safe" -eq 1 ]; then
    drop_database "$staging_db" >/dev/null 2>&1 || true
  elif [ "$switch_started" -eq 1 ]; then
    printf 'Staging database %s was preserved for diagnosis after cutover began.\n' "$staging_db" >&2
  fi

  if [ "$exit_code" -ne 0 ] && [ "$writers_stopped" -eq 1 ]; then
    if [ "$restart_attempted" -eq 1 ]; then
      printf 'Writer restart did not complete; game and web services are treated as stopped. Rollback database %s was preserved.\n' "$rollback_db" >&2
    else
      printf 'Restore did not complete; game and web services remain stopped.\n' >&2
    fi
  fi

  exit "$exit_code"
}
trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

if [ -f "$backup_file.sha256" ]; then
  (cd "$(dirname "$backup_file")" && sha256sum -c "$(basename "$backup_file").sha256")
fi

case "$backup_file" in
  *.age)
    if [ ! -f "$backup_file.sha256" ]; then
      printf 'Encrypted restore requires the matching SHA-256 sidecar.\n' >&2
      exit 1
    fi
    if [ -z "$age_identity_file" ] || [ ! -f "$age_identity_file" ]; then
      printf 'BACKUP_AGE_IDENTITY_FILE must reference an existing identity file for encrypted restores.\n' >&2
      exit 1
    fi
    if ! command -v "$age_command" >/dev/null 2>&1; then
      printf 'Encrypted restore requires the age command.\n' >&2
      exit 1
    fi
    "$age_command" -d -i "$age_identity_file" -o "$temporary_gzip" "$backup_file"
    ;;
  *)
    cp "$backup_file" "$temporary_gzip"
    ;;
esac

gzip -t "$temporary_gzip"
gzip -dc "$temporary_gzip" > "$temporary_sql"
test -s "$temporary_sql"

compose exec -T postgres createdb -U "$POSTGRES_USER" -O "$POSTGRES_USER" "$staging_db"
compose exec -T postgres psql -v ON_ERROR_STOP=1 --single-transaction -U "$POSTGRES_USER" "$staging_db" < "$temporary_sql"
POSTGRES_ROLE_DATABASE="$staging_db" compose run --rm --no-deps -T postgres-roles
MIGRATION_DATABASE_URL="$staging_database_url" compose run --rm --no-deps -T migrate
POSTGRES_ROLE_DATABASE="$staging_db" compose run --rm --no-deps -T postgres-roles
validate_staging_database

printf 'Switching validated restore %s into database %s...\n' "$backup_file" "$POSTGRES_DB"
writers_to_restart="$(compose ps --status running --services web game)"
web_was_running=0
game_was_running=0
for writer in $writers_to_restart; do
  case "$writer" in
    web) web_was_running=1 ;;
    game) game_was_running=1 ;;
  esac
done

if [ "$restore_only" -ne 1 ] && { [ "$web_was_running" -ne 1 ] || [ "$game_was_running" -ne 1 ]; }; then
  printf 'Both web and game must be running so restore readiness can be verified. Set RESTORE_ONLY=1 for an offline restore that preserves the rollback database.\n' >&2
  exit 1
fi

writers_stopped=1
compose stop web game >/dev/null

switch_started=1
staging_cleanup_safe=0
rename_database "$POSTGRES_DB" "$rollback_db"
rollback_available=1
target_available=0

rename_database "$staging_db" "$POSTGRES_DB"
target_available=1
staging_cleanup_safe=1

if [ "$restore_only" -ne 1 ]; then
  restart_attempted=1
  compose up -d --no-recreate --wait --wait-timeout "$restore_health_timeout" web game >/dev/null
  writers_stopped=0

  drop_database "$rollback_db"
  rollback_available=0
  printf 'Restore completed.\n'
else
  printf 'Offline restore completed; rollback database %s is preserved until web and game readiness are verified manually.\n' "$rollback_db"
fi
