#!/usr/bin/env sh
set -eu

script_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
# shellcheck disable=SC1091
. "$script_dir/deploy-operations-lib.sh"
# shellcheck disable=SC1091
. "$script_dir/restore-database-checks.sh"

if [ "$#" -ne 1 ]; then
  printf 'Usage: %s <rollback-database>\n' "$0" >&2
  exit 1
fi

rollback_database="$1"
POSTGRES_USER="${POSTGRES_USER:-werewolf}"
POSTGRES_DB="${POSTGRES_DB:-werewolf}"
docker_command="${RESTORE_DOCKER_COMMAND:-docker}"
node_command="${RESTORE_NODE_COMMAND:-node}"
release_state_dir="${RELEASE_STATE_DIR:-/var/lib/werewolf/release-state}"
operations_lock_dir="${OPERATIONS_LOCK_DIR:-$release_state_dir/operations.lock}"
schema_manifest="${RESTORE_ACCEPT_SCHEMA_MANIFEST:-$release_state_dir/schema-current.json}"
schema_manifest_signature="${RESTORE_ACCEPT_SCHEMA_MANIFEST_SIGNATURE:-${schema_manifest}.sig}"
release_manifest_command="${RESTORE_RELEASE_MANIFEST_COMMAND:-$script_dir/release-manifest.mjs}"
release_manifest_public_key="${RELEASE_MANIFEST_PUBLIC_KEY:-}"
release_allowed_image_prefix="${RELEASE_ALLOWED_IMAGE_PREFIX:-}"

case "$rollback_database" in
  "$POSTGRES_DB"_restore_rollback_[A-Za-z0-9_-]*) ;;
  *)
    printf 'Rollback database must use the %s_restore_rollback_<run-id> naming boundary.\n' "$POSTGRES_DB" >&2
    exit 1
    ;;
esac
if [ "${#rollback_database}" -gt 63 ]; then
  printf 'Rollback database name exceeds PostgreSQL identifier limits.\n' >&2
  exit 1
fi
if [ "${RESTORE_ACCEPT_DATABASE:-}" != "$POSTGRES_DB" ]; then
  printf 'Set RESTORE_ACCEPT_DATABASE=%s after validating the restored application.\n' "$POSTGRES_DB" >&2
  exit 1
fi
if [ "${RESTORE_ACCEPT_ROLLBACK_DATABASE:-}" != "$rollback_database" ]; then
  printf 'Set RESTORE_ACCEPT_ROLLBACK_DATABASE=%s to authorize deletion of that exact rollback copy.\n' "$rollback_database" >&2
  exit 1
fi
if [ ! -f "$schema_manifest" ] || [ ! -f "$schema_manifest_signature" ]; then
  printf 'Signed applied-schema provenance is required before rollback deletion: %s\n' \
    "$schema_manifest" >&2
  exit 1
fi
if [ ! -f "$release_manifest_command" ]; then
  printf 'RESTORE_RELEASE_MANIFEST_COMMAND is unavailable: %s\n' "$release_manifest_command" >&2
  exit 1
fi
if [ -z "$release_manifest_public_key" ] || [ ! -f "$release_manifest_public_key" ]; then
  printf 'RELEASE_MANIFEST_PUBLIC_KEY must reference the trusted Ed25519 public key.\n' >&2
  exit 1
fi
if [ -z "$release_allowed_image_prefix" ]; then
  printf 'RELEASE_ALLOWED_IMAGE_PREFIX is required to validate applied-schema provenance.\n' >&2
  exit 1
fi

compose() {
  "$docker_command" compose "$@"
}

database_exists() {
  checked_database="$1"
  database_count="$(
    compose exec -T postgres psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres \
      -v database_name="$checked_database" -Atq <<'SQL'
SELECT count(*) FROM pg_database WHERE datname = :'database_name';
SQL
  )"
  test "$database_count" = "1"
}

acceptance_cleanup() {
  exit_code=$?
  trap - EXIT HUP INT TERM
  release_operations_lock
  exit "$exit_code"
}

mkdir -p "$release_state_dir"
chmod 700 "$release_state_dir" 2>/dev/null || true
acquire_operations_lock "restore-accept" "$operations_lock_dir"
trap acceptance_cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

"$node_command" --env-file-if-exists=.env "$release_manifest_command" \
  "$schema_manifest" \
  --signature "$schema_manifest_signature" \
  --public-key "$release_manifest_public_key" \
  --allowed-image-prefix "$release_allowed_image_prefix"

if ! database_exists "$POSTGRES_DB" || ! database_exists "$rollback_database"; then
  printf 'Both live database %s and rollback database %s must exist. Nothing was deleted.\n' \
    "$POSTGRES_DB" "$rollback_database" >&2
  exit 1
fi

restore_validate_database_structure "$POSTGRES_DB"
restore_validate_database_semantics "$POSTGRES_DB"
compose exec -T web wget -qO- http://127.0.0.1:3000/api/health/ready >/dev/null
compose exec -T game wget -qO- http://127.0.0.1:2567/health/ready >/dev/null
"$node_command" --env-file-if-exists=.env "$script_dir/deploy-public-health.mjs"

compose exec -T postgres dropdb --if-exists --force -U "$POSTGRES_USER" "$rollback_database"

acceptance_dir="${OPERATIONS_FORENSICS_DIR:-$release_state_dir/forensics}"
acceptance_record="$acceptance_dir/$(date -u +%Y%m%dT%H%M%SZ)-restore-accept-$$.log"
umask 077
mkdir -p "$acceptance_dir"
{
  printf 'action=restore-accept\n'
  printf 'live_database=%s\n' "$POSTGRES_DB"
  printf 'deleted_rollback_database=%s\n' "$rollback_database"
  printf 'accepted_at=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
} > "$acceptance_record"
chmod 600 "$acceptance_record"
printf 'Restore accepted; rollback database %s was deleted after semantic and ingress revalidation.\n' \
  "$rollback_database"
