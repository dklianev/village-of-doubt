#!/usr/bin/env sh
set -eu

script_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
# shellcheck disable=SC1091
. "$script_dir/deploy-operations-lib.sh"
# shellcheck disable=SC1091
. "$script_dir/restore-database-checks.sh"

if [ $# -ne 1 ]; then
  printf 'Usage: %s /path/to/werewolf_YYYY-MM-DD_HH-MM-SS.sql.gz[.age]\n' "$0" >&2
  exit 1
fi

backup_file="$1"
POSTGRES_USER="${POSTGRES_USER:-werewolf}"
POSTGRES_DB="${POSTGRES_DB:-werewolf}"
restore_confirmation="${RESTORE_CONFIRM_DATABASE:-}"
docker_command="${RESTORE_DOCKER_COMMAND:-docker}"
node_command="${RESTORE_NODE_COMMAND:-node}"
restore_run_id="${RESTORE_RUN_ID:-$$}"
restore_health_timeout="${RESTORE_HEALTH_TIMEOUT_SECONDS:-180}"
restore_only="${RESTORE_ONLY:-0}"
age_command="${BACKUP_AGE_COMMAND:-age}"
age_identity_file="${BACKUP_AGE_IDENTITY_FILE:-}"
require_signature="${BACKUP_REQUIRE_SIGNATURE:-1}"
signing_public_key="${BACKUP_SIGNING_PUBLIC_KEY_FILE:-}"
manifest_command="${BACKUP_MANIFEST_COMMAND:-$(dirname "$0")/backup-manifest.mjs}"
restore_max_age_hours="${BACKUP_MAX_RESTORE_AGE_HOURS:-876000}"
backup_clock_skew_seconds="${BACKUP_CLOCK_SKEW_SECONDS:-300}"
release_state_dir="${RELEASE_STATE_DIR:-/var/lib/werewolf/release-state}"
operations_lock_dir="${OPERATIONS_LOCK_DIR:-$release_state_dir/operations.lock}"
active_release_manifest="${RESTORE_RELEASE_MANIFEST:-$release_state_dir/current.json}"
active_release_signature="${RESTORE_RELEASE_MANIFEST_SIGNATURE:-${active_release_manifest}.sig}"
release_manifest_command="${RESTORE_RELEASE_MANIFEST_COMMAND:-$script_dir/release-manifest.mjs}"
release_manifest_public_key="${RELEASE_MANIFEST_PUBLIC_KEY:-}"
release_allowed_image_prefix="${RELEASE_ALLOWED_IMAGE_PREFIX:-}"
schema_manifest="$release_state_dir/schema-current.json"
pending_migration_manifest="$release_state_dir/migration-pending.json"
schema_manifest_tmp="$release_state_dir/schema-current.json.restore.$$"
schema_signature_tmp="$release_state_dir/schema-current.json.sig.restore.$$"
compose_wait_timeout="${COMPOSE_WAIT_TIMEOUT_SECONDS:-$restore_health_timeout}"
migration_lock_timeout_ms="${MIGRATION_LOCK_TIMEOUT_MS:-5000}"
migration_statement_timeout_ms="${MIGRATION_STATEMENT_TIMEOUT_MS:-300000}"
migration_idle_timeout_ms="${MIGRATION_IDLE_TRANSACTION_TIMEOUT_MS:-300000}"
migration_process_timeout_seconds="${MIGRATION_PROCESS_TIMEOUT_SECONDS:-600}"

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

require_positive_integer "COMPOSE_WAIT_TIMEOUT_SECONDS" "$compose_wait_timeout"
require_positive_integer "MIGRATION_LOCK_TIMEOUT_MS" "$migration_lock_timeout_ms"
require_positive_integer "MIGRATION_STATEMENT_TIMEOUT_MS" "$migration_statement_timeout_ms"
require_positive_integer "MIGRATION_IDLE_TRANSACTION_TIMEOUT_MS" "$migration_idle_timeout_ms"
require_positive_integer "MIGRATION_PROCESS_TIMEOUT_SECONDS" "$migration_process_timeout_seconds"
if [ "$migration_lock_timeout_ms" -ge "$migration_statement_timeout_ms" ] || \
  [ "$migration_statement_timeout_ms" -ge $((migration_process_timeout_seconds * 1000)) ] || \
  [ "$migration_idle_timeout_ms" -ge $((migration_process_timeout_seconds * 1000)) ]; then
  printf 'Migration lock/statement/idle timeouts must fit inside MIGRATION_PROCESS_TIMEOUT_SECONDS.\n' >&2
  exit 1
fi
migration_pgoptions="-c lock_timeout=$migration_lock_timeout_ms -c statement_timeout=$migration_statement_timeout_ms -c idle_in_transaction_session_timeout=$migration_idle_timeout_ms"

case "$restore_only" in
  0|1) ;;
  *)
    printf 'RESTORE_ONLY must be 0 or 1.\n' >&2
    exit 1
    ;;
esac

case "$require_signature" in
  0|1) ;;
  *)
    printf 'BACKUP_REQUIRE_SIGNATURE must be 0 or 1.\n' >&2
    exit 1
    ;;
esac

case "$backup_file" in
  *.age)
    if [ -z "$age_identity_file" ] || [ ! -f "$age_identity_file" ]; then
      printf 'BACKUP_AGE_IDENTITY_FILE must reference an existing identity file for encrypted restores.\n' >&2
      exit 1
    fi
    ;;
esac

if [ "$require_signature" = "1" ] && { [ -z "$signing_public_key" ] || [ ! -f "$signing_public_key" ]; }; then
  printf 'BACKUP_SIGNING_PUBLIC_KEY_FILE must reference an Ed25519 public key.\n' >&2
  exit 1
fi

if [ -z "${MIGRATION_DATABASE_URL:-}" ]; then
  printf 'MIGRATION_DATABASE_URL is required to migrate the staging database.\n' >&2
  exit 1
fi

if [ ! -f "$active_release_manifest" ] || [ ! -f "$active_release_signature" ]; then
  printf 'A signed active release manifest is required for an immutable restore: %s\n' \
    "$active_release_manifest" >&2
  exit 1
fi
if [ ! -f "$release_manifest_command" ]; then
  printf 'RESTORE_RELEASE_MANIFEST_COMMAND is unavailable: %s\n' "$release_manifest_command" >&2
  exit 1
fi
if [ -z "$release_manifest_public_key" ] || [ ! -f "$release_manifest_public_key" ]; then
  printf 'RELEASE_MANIFEST_PUBLIC_KEY must reference the trusted Ed25519 public key for restore.\n' >&2
  exit 1
fi
if [ -z "$release_allowed_image_prefix" ]; then
  printf 'RELEASE_ALLOWED_IMAGE_PREFIX is required for restore image validation.\n' >&2
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
  restore_validate_database_structure "$staging_db"
}

capture_current_tombstones() {
  compose exec -T postgres psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atqc "
    SELECT original_user_id || E'\t' || anonymous_user_id
    FROM public.deleted_user_identities
    ORDER BY original_user_id;
  " > "$temporary_tombstones"
}

reapply_current_tombstones_to_staging() {
  if [ ! -s "$temporary_tombstones" ]; then
    return
  fi

  {
    cat <<'SQL'
CREATE TEMP TABLE current_deleted_user_identities (
  original_user_id text PRIMARY KEY,
  anonymous_user_id text NOT NULL UNIQUE
);
\copy current_deleted_user_identities (original_user_id, anonymous_user_id) FROM STDIN
SQL
    cat "$temporary_tombstones"
    cat <<'SQL'
\.
INSERT INTO public.deleted_user_identities (original_user_id, anonymous_user_id)
SELECT original_user_id, anonymous_user_id
FROM current_deleted_user_identities
ON CONFLICT (original_user_id) DO NOTHING;
DO $$
DECLARE
  tombstone record;
BEGIN
  FOR tombstone IN
    SELECT original_user_id, anonymous_user_id
    FROM current_deleted_user_identities
    ORDER BY original_user_id
  LOOP
    PERFORM public.werewolf_delete_account(tombstone.original_user_id, tombstone.anonymous_user_id);
  END LOOP;
END
$$;
SQL
  } > "$temporary_tombstone_sql"

  compose exec -T postgres psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$staging_db" < "$temporary_tombstone_sql"
}

temporary_sql="$(mktemp "${TMPDIR:-/tmp}/werewolf_restore.XXXXXX")"
temporary_gzip="$(mktemp "${TMPDIR:-/tmp}/werewolf_restore.XXXXXX.gz")"
temporary_tombstones="$(mktemp "${TMPDIR:-/tmp}/werewolf_restore_tombstones.XXXXXX")"
temporary_tombstone_sql="$(mktemp "${TMPDIR:-/tmp}/werewolf_restore_tombstones.XXXXXX.sql")"
temporary_release_env="$(mktemp "${TMPDIR:-/tmp}/werewolf_restore_release.XXXXXX.env")"
writers_stopped=0
restart_attempted=0
switch_started=0
target_available=1
rollback_available=0
staging_cleanup_safe=1
staging_created=0
writers_to_restart=""
migration_container_started=0
migrator_container_name="werewolf-restore-migrator-$restore_run_id"

preserve_restore_record() {
  record_exit_code="$1"
  record_dir="${OPERATIONS_FORENSICS_DIR:-$release_state_dir/forensics}"
  record_file="$record_dir/$(date -u +%Y%m%dT%H%M%SZ)-restore-$$.log"
  umask 077
  mkdir -p "$record_dir" || return 0
  {
    printf 'action=restore\n'
    printf 'exit_code=%s\n' "$record_exit_code"
    printf 'backup=%s\n' "$(basename -- "$backup_file")"
    printf 'target_database=%s\n' "$POSTGRES_DB"
    printf 'staging_database=%s\n' "$staging_db"
    printf 'rollback_database=%s\n' "$rollback_db"
    printf 'rollback_available=%s\n' "$rollback_available"
    printf 'switch_started=%s\n' "$switch_started"
    printf 'captured_at=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  } > "$record_file"
  chmod 600 "$record_file" 2>/dev/null || true
  printf 'Restore operation record preserved at %s.\n' "$record_file" >&2
}

record_restored_schema() {
  cp "$active_release_manifest" "$schema_manifest_tmp"
  cp "$active_release_signature" "$schema_signature_tmp"
  chmod 600 "$schema_manifest_tmp" "$schema_signature_tmp"
  mv "$schema_signature_tmp" "$schema_manifest.sig"
  mv "$schema_manifest_tmp" "$schema_manifest"
  rm -f "$pending_migration_manifest" "$pending_migration_manifest.sig"
}

cleanup() {
  exit_code=$?
  trap - EXIT HUP INT TERM
  rm -f "$temporary_sql" "$temporary_gzip" "$temporary_tombstones" \
    "$temporary_tombstone_sql" "$temporary_release_env" \
    "$schema_manifest_tmp" "$schema_signature_tmp"

  if [ "$exit_code" -ne 0 ] && [ "$migration_container_started" -eq 1 ]; then
    preserve_and_stop_container "$docker_command" "$migrator_container_name" "$release_state_dir" \
      "restore-migrator" || true
  fi

  if [ "$exit_code" -ne 0 ] && [ "$rollback_available" -eq 1 ]; then
    compose stop web game >/dev/null 2>&1 || true
    writers_stopped=1

    if [ "$target_available" -eq 1 ]; then
      terminate_database_sessions "$POSTGRES_DB" >/dev/null 2>&1 || true
      if rename_database "$POSTGRES_DB" "$staging_db" >/dev/null 2>&1; then
        target_available=0
        staging_cleanup_safe=0
        staging_created=1
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

  if [ "$staging_cleanup_safe" -eq 1 ] && [ "$staging_created" -eq 1 ]; then
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

  preserve_restore_record "$exit_code"
  release_operations_lock
  exit "$exit_code"
}

mkdir -p "$release_state_dir"
chmod 700 "$release_state_dir" 2>/dev/null || true
if ! acquire_operations_lock "restore" "$operations_lock_dir"; then
  rm -f "$temporary_sql" "$temporary_gzip" "$temporary_tombstones" \
    "$temporary_tombstone_sql" "$temporary_release_env"
  exit 73
fi
trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

"$node_command" --env-file-if-exists=.env "$release_manifest_command" \
  "$active_release_manifest" \
  --signature "$active_release_signature" \
  --public-key "$release_manifest_public_key" \
  --allowed-image-prefix "$release_allowed_image_prefix" \
  --env-output "$temporary_release_env"
chmod 600 "$temporary_release_env"
set -a
# shellcheck disable=SC1090
. "$temporary_release_env"
set +a

if [ "$require_signature" = "1" ]; then
  node "$manifest_command" verify \
    "$backup_file" \
    "$signing_public_key" \
    "$POSTGRES_DB" \
    "$restore_max_age_hours" \
    "$backup_clock_skew_seconds" >/dev/null
fi

if [ -f "$backup_file.sha256" ]; then
  (cd "$(dirname "$backup_file")" && sha256sum -c "$(basename "$backup_file").sha256")
fi

case "$backup_file" in
  *.age)
    if [ ! -f "$backup_file.sha256" ]; then
      printf 'Encrypted restore requires the matching SHA-256 sidecar.\n' >&2
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

compose config --quiet
compose pull migrate web game caddy

compose exec -T postgres createdb -U "$POSTGRES_USER" -O "$POSTGRES_USER" "$staging_db"
staging_created=1
compose exec -T postgres psql -v ON_ERROR_STOP=1 --single-transaction -U "$POSTGRES_USER" "$staging_db" < "$temporary_sql"
POSTGRES_ROLE_DATABASE="$staging_db" compose run --rm --no-deps -T postgres-roles
migration_container_started=1
run_with_process_timeout "$migration_process_timeout_seconds" \
  env "MIGRATION_DATABASE_URL=$staging_database_url" "PGOPTIONS=$migration_pgoptions" \
  "$docker_command" compose run --name "$migrator_container_name" --rm --no-deps -T \
  -e "PGOPTIONS=$migration_pgoptions" migrate
migration_container_started=0
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
capture_current_tombstones
reapply_current_tombstones_to_staging
terminate_database_sessions "$POSTGRES_DB" >/dev/null

switch_started=1
staging_cleanup_safe=0
rename_database "$POSTGRES_DB" "$rollback_db"
rollback_available=1
target_available=0

rename_database "$staging_db" "$POSTGRES_DB"
target_available=1
staging_cleanup_safe=1
staging_created=0

restore_validate_database_semantics "$POSTGRES_DB"
restore_verify_captured_tombstones \
  "$POSTGRES_DB" "$temporary_tombstones" "$temporary_tombstone_sql"

if [ "$restore_only" -ne 1 ]; then
  restart_attempted=1
  compose up -d --force-recreate --no-build --no-deps --wait \
    --wait-timeout "$compose_wait_timeout" web game caddy >/dev/null
  compose exec -T web \
    wget -qO- http://127.0.0.1:3000/api/health/ready >/dev/null
  compose exec -T game \
    wget -qO- http://127.0.0.1:2567/health/ready >/dev/null
  "$node_command" --env-file-if-exists=.env "$script_dir/deploy-public-health.mjs"
  writers_stopped=0
fi

record_restored_schema

if [ "$restore_only" -ne 1 ]; then
  printf 'Restore completed semantic and ingress checks. Rollback database %s is retained until explicit acceptance.\n' "$rollback_db"
  printf 'Accept with RESTORE_ACCEPT_DATABASE=%s RESTORE_ACCEPT_ROLLBACK_DATABASE=%s sh scripts/restore-accept.sh %s\n' \
    "$POSTGRES_DB" "$rollback_db" "$rollback_db"
else
  printf 'Offline restore completed semantic database checks; rollback database %s is preserved until application readiness and explicit acceptance.\n' "$rollback_db"
fi
