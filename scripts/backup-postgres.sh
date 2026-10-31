#!/usr/bin/env sh
set -eu

script_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
# shellcheck disable=SC1091
. "$script_dir/deploy-operations-lib.sh"

retention_dry_run=0
case "$#" in
  0) ;;
  1)
    if [ "$1" != "--retention-dry-run" ]; then
      printf 'Usage: %s [--retention-dry-run]\n' "$0" >&2
      exit 1
    fi
    retention_dry_run=1
    ;;
  *)
    printf 'Usage: %s [--retention-dry-run]\n' "$0" >&2
    exit 1
    ;;
esac

BACKUP_DIR="${BACKUP_DIR:-/backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
POSTGRES_USER="${POSTGRES_USER:-werewolf}"
POSTGRES_DB="${POSTGRES_DB:-werewolf}"
docker_command="${BACKUP_DOCKER_COMMAND:-docker}"
fixed_container="${BACKUP_POSTGRES_CONTAINER:-}"
compose_project="${COMPOSE_PROJECT_NAME:-${BACKUP_COMPOSE_PROJECT:-}}"
require_fixed_container="${BACKUP_REQUIRE_FIXED_CONTAINER:-0}"
require_offsite="${BACKUP_REQUIRE_OFFSITE:-0}"
require_encryption="${BACKUP_REQUIRE_ENCRYPTION:-$require_fixed_container}"
require_signature="${BACKUP_REQUIRE_SIGNATURE:-$require_encryption}"
age_recipient="${BACKUP_AGE_RECIPIENT:-}"
age_command="${BACKUP_AGE_COMMAND:-age}"
signing_private_key="${BACKUP_SIGNING_PRIVATE_KEY_FILE:-}"
manifest_command="${BACKUP_MANIFEST_COMMAND:-$(dirname "$0")/backup-manifest.mjs}"
release_version="${BACKUP_RELEASE_VERSION:-}"
migration_head="${BACKUP_MIGRATION_HEAD:-}"
require_active_release="${BACKUP_REQUIRE_ACTIVE_RELEASE:-0}"
release_manifest="${BACKUP_RELEASE_MANIFEST:-/var/lib/werewolf/release-state/current.json}"
release_manifest_signature="${BACKUP_RELEASE_MANIFEST_SIGNATURE:-${release_manifest}.sig}"
schema_manifest="${BACKUP_SCHEMA_MANIFEST:-$(dirname "$release_manifest")/schema-current.json}"
schema_manifest_signature="${schema_manifest}.sig"
pending_migration_manifest="$(dirname "$schema_manifest")/migration-pending.json"
provenance_dir=""
release_manifest_command="${BACKUP_RELEASE_MANIFEST_COMMAND:-$(dirname "$0")/release-manifest.mjs}"
release_manifest_public_key="${BACKUP_RELEASE_MANIFEST_PUBLIC_KEY_FILE:-/etc/werewolf/release-manifest.pub}"
release_allowed_image_prefix="${BACKUP_RELEASE_ALLOWED_IMAGE_PREFIX:-}"
rclone_command="${RCLONE_COMMAND:-rclone}"
rclone_remote="${RCLONE_REMOTE:-}"
deletion_ledger_remote="${RCLONE_DELETION_LEDGER_REMOTE:-}"
rclone_retention_days="${RCLONE_BACKUP_RETENTION_DAYS:-30}"

validate_rclone_prefix() {
  value="$1"
  label="$2"
  remote_name="${value%%:*}"
  remote_prefix="${value#*:}"

  if [ "$remote_name" = "$value" ]; then
    printf '%s must be an explicit non-root rclone prefix in remote:path form.\n' "$label" >&2
    exit 1
  fi
  case "$remote_name" in
    ""|*[!A-Za-z0-9_.-]*)
      printf '%s must use a named rclone remote with only letters, numbers, dots, underscores, and hyphens.\n' "$label" >&2
      exit 1
      ;;
  esac
  case "$remote_prefix" in
    ""|.|..|/*|*/|./*|*/./*|*/.|../*|*/../*|*/..|*//*)
      printf '%s must be an explicit non-root rclone prefix without dot or empty path segments.\n' "$label" >&2
      exit 1
      ;;
  esac
}

run_offsite_retention() {
  if [ "$retention_dry_run" -eq 1 ]; then
    "$rclone_command" delete "$rclone_remote" \
      --min-age "${rclone_retention_days}d" \
      --include 'werewolf_*.sql.gz*' \
      --dry-run
  else
    "$rclone_command" delete "$rclone_remote" \
      --min-age "${rclone_retention_days}d" \
      --include 'werewolf_*.sql.gz*'
  fi
}

case "$require_offsite" in
  0|1) ;;
  *) printf 'BACKUP_REQUIRE_OFFSITE must be 0 or 1.\n' >&2; exit 1 ;;
esac

if [ "$require_offsite" = "1" ] || [ -n "$rclone_remote" ] || [ -n "$deletion_ledger_remote" ] || [ "$retention_dry_run" -eq 1 ]; then
  if [ -z "$rclone_remote" ]; then
    printf 'RCLONE_REMOTE is required for off-site retention.\n' >&2
    exit 1
  fi
  if [ -z "$deletion_ledger_remote" ]; then
    printf 'RCLONE_DELETION_LEDGER_REMOTE is required for protected deletion recovery.\n' >&2
    exit 1
  fi
  validate_rclone_prefix "$rclone_remote" "RCLONE_REMOTE"
  validate_rclone_prefix "$deletion_ledger_remote" "RCLONE_DELETION_LEDGER_REMOTE"
  if [ "${rclone_remote%%:*}" = "${deletion_ledger_remote%%:*}" ]; then
    printf 'RCLONE_REMOTE and RCLONE_DELETION_LEDGER_REMOTE must use separate rclone remote profiles.\n' >&2
    exit 1
  fi
  case "$rclone_retention_days" in
    ""|*[!0-9]*|0)
      printf 'RCLONE_BACKUP_RETENTION_DAYS must be an integer from 1 through 30.\n' >&2
      exit 1
      ;;
  esac
  if [ "$rclone_retention_days" -gt 30 ]; then
    printf 'RCLONE_BACKUP_RETENTION_DAYS must be an integer from 1 through 30.\n' >&2
    exit 1
  fi
  if ! command -v "$rclone_command" >/dev/null 2>&1; then
    printf 'Off-site retention is configured, but the rclone command is unavailable: %s\n' "$rclone_command" >&2
    exit 1
  fi

  if [ "$retention_dry_run" -eq 1 ]; then
    run_offsite_retention
    exit 0
  fi
fi

case "$require_encryption" in
  0|1) ;;
  *)
    printf 'BACKUP_REQUIRE_ENCRYPTION must be 0 or 1.\n' >&2
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

case "$require_active_release" in
  0|1) ;;
  *)
    printf 'BACKUP_REQUIRE_ACTIVE_RELEASE must be 0 or 1.\n' >&2
    exit 1
    ;;
esac

if [ "$require_encryption" = "1" ] && [ -z "$age_recipient" ]; then
  printf 'BACKUP_AGE_RECIPIENT is required for scheduled or encryption-required backups.\n' >&2
  exit 1
fi

case "$age_recipient" in
  ""|age1[0-9a-z]*) ;;
  *)
    printf 'BACKUP_AGE_RECIPIENT must be a valid native age recipient.\n' >&2
    exit 1
    ;;
esac

if [ -n "$age_recipient" ] && ! command -v "$age_command" >/dev/null 2>&1; then
  printf 'BACKUP_AGE_RECIPIENT is set, but the age command is unavailable.\n' >&2
  exit 1
fi

if [ "$require_active_release" = "1" ]; then
  validate_compose_project "$compose_project"
  if [ ! -f "$release_manifest" ] || [ ! -f "$release_manifest_signature" ]; then
    printf 'Active signed release manifest is unavailable: %s\n' "$release_manifest" >&2
    exit 1
  fi
  if [ ! -f "$release_manifest_command" ] || [ ! -f "$release_manifest_public_key" ]; then
    printf 'Active release verification tooling is unavailable.\n' >&2
    exit 1
  fi
  if [ -z "$release_allowed_image_prefix" ]; then
    printf 'BACKUP_RELEASE_ALLOWED_IMAGE_PREFIX is required for active release verification.\n' >&2
    exit 1
  fi
  if [ -e "$pending_migration_manifest" ] || [ -L "$pending_migration_manifest" ] || \
    [ -e "$pending_migration_manifest.sig" ] || [ -L "$pending_migration_manifest.sig" ]; then
    printf 'Applied schema is unresolved: migration pending marker exists.\n' >&2
    exit 1
  fi
  if [ -e "$(dirname "$schema_manifest")/restore-recovery-required.txt" ]; then
    printf 'Restore recovery is unresolved; backup provenance cannot be trusted.\n' >&2
    exit 1
  fi
  if [ ! -r "$schema_manifest" ] || [ ! -r "$schema_manifest_signature" ]; then
    printf 'Signed applied-schema provenance is unavailable: %s\n' "$schema_manifest" >&2
    exit 1
  fi
  provenance_dir="$(mktemp -d)"
  trap 'rm -rf "$provenance_dir"' EXIT HUP INT TERM
  cp "$release_manifest" "$provenance_dir/current.json"
  cp "$release_manifest_signature" "$provenance_dir/current.json.sig"
  cp "$schema_manifest" "$provenance_dir/schema.json"
  cp "$schema_manifest_signature" "$provenance_dir/schema.json.sig"
  provenance_env="$provenance_dir/provenance.env"
  node --jitless "$release_manifest_command" "$provenance_dir/current.json" \
    --signature "$provenance_dir/current.json.sig" \
    --public-key "$release_manifest_public_key" \
    --allowed-image-prefix "$release_allowed_image_prefix" \
    --env-output "$provenance_env"
  # release-manifest.mjs writes shell-safe, validated tokens only.
  # shellcheck disable=SC1090
  . "$provenance_env"
  release_version="$RELEASE_VERSION"
  node --jitless "$release_manifest_command" "$provenance_dir/schema.json" \
    --signature "$provenance_dir/schema.json.sig" \
    --public-key "$release_manifest_public_key" \
    --allowed-image-prefix "$release_allowed_image_prefix" \
    --env-output "$provenance_env"
  # The applied schema may be newer than the last healthy application release.
  # shellcheck disable=SC1090
  . "$provenance_env"
  migration_head="$MIGRATION_HEAD"
fi

verify_unchanged_provenance() {
  [ "$require_active_release" = "1" ] || return 0
  if [ -e "$pending_migration_manifest" ] || [ -L "$pending_migration_manifest" ] || \
    [ -e "$(dirname "$schema_manifest")/restore-recovery-required.txt" ] || \
    [ -e "$pending_migration_manifest.sig" ] || [ -L "$pending_migration_manifest.sig" ] || \
    ! cmp -s "$release_manifest" "$provenance_dir/current.json" || \
    ! cmp -s "$release_manifest_signature" "$provenance_dir/current.json.sig" || \
    ! cmp -s "$schema_manifest" "$provenance_dir/schema.json" || \
    ! cmp -s "$schema_manifest_signature" "$provenance_dir/schema.json.sig"; then
    printf 'Release/schema provenance changed or migration is unresolved; backup will not be published.\n' >&2
    return 1
  fi
}

if [ "$require_signature" = "1" ]; then
  case "$release_version" in
    ""|unknown|unavailable|latest|local|main)
      printf 'BACKUP_RELEASE_VERSION must contain immutable release provenance.\n' >&2
      exit 1
      ;;
  esac
  case "$migration_head" in
    ""|unknown|unavailable|latest)
      printf 'BACKUP_MIGRATION_HEAD must contain exact schema provenance.\n' >&2
      exit 1
      ;;
  esac
  if [ -z "$signing_private_key" ] || [ ! -f "$signing_private_key" ]; then
    printf 'BACKUP_SIGNING_PRIVATE_KEY_FILE must reference an Ed25519 private key.\n' >&2
    exit 1
  fi
  if [ ! -f "$manifest_command" ]; then
    printf 'BACKUP_MANIFEST_COMMAND is unavailable: %s\n' "$manifest_command" >&2
    exit 1
  fi
fi

if [ -n "$rclone_remote" ] && { [ "$require_encryption" != "1" ] || [ "$require_signature" != "1" ]; }; then
  printf 'Off-site backups and deletion ledgers require encryption and signed manifests.\n' >&2
  exit 1
fi

validate_docker_identifier() {
  value="$1"
  label="$2"

  case "$value" in
    ""|*[!A-Za-z0-9_.-]*)
      printf '%s must contain only letters, numbers, dots, underscores, and hyphens.\n' "$label" >&2
      exit 1
      ;;
  esac
}

resolve_postgres_container() {
  if [ -n "${BACKUP_COMPOSE_PROJECT:-}" ] && [ "$BACKUP_COMPOSE_PROJECT" != "$compose_project" ]; then
    printf 'BACKUP_COMPOSE_PROJECT conflicts with COMPOSE_PROJECT_NAME.\n' >&2
    exit 1
  fi
  if [ -n "$compose_project" ]; then
    validate_compose_project "$compose_project"
  fi
  if [ -n "$fixed_container" ]; then
    validate_docker_identifier "$fixed_container" "BACKUP_POSTGRES_CONTAINER"
    if [ -n "$compose_project" ]; then
      container_identity="$("$docker_command" inspect --format \
        '{{index .Config.Labels "com.docker.compose.project"}}/{{index .Config.Labels "com.docker.compose.service"}}' "$fixed_container")"
      if [ "$container_identity" != "$compose_project/postgres" ]; then
        printf 'Fixed PostgreSQL container does not belong to the configured Compose project.\n' >&2
        exit 1
      fi
    fi
    printf '%s\n' "$fixed_container"
    return
  fi

  if [ -n "$compose_project" ]; then
    validate_docker_identifier "$compose_project" "BACKUP_COMPOSE_PROJECT"
    container_ids="$(
      "$docker_command" ps \
        --filter "label=com.docker.compose.project=$compose_project" \
        --filter "label=com.docker.compose.service=postgres" \
        --filter "status=running" \
        --format "{{.ID}}"
    )"
    set -- $container_ids
    if [ "$#" -ne 1 ]; then
      printf 'Expected exactly one running PostgreSQL container for Compose project %s; found %s.\n' \
        "$compose_project" "$#" >&2
      exit 1
    fi
    printf '%s\n' "$1"
    return
  fi

  if [ "$require_fixed_container" = "1" ]; then
    printf 'BACKUP_COMPOSE_PROJECT or BACKUP_POSTGRES_CONTAINER is required for scheduled backups.\n' >&2
    exit 1
  fi

  printf '\n'
}

if [ -n "$rclone_remote" ]; then
  run_offsite_retention
fi

mkdir -p "$BACKUP_DIR"
backup_timestamp="$(date +%F_%H-%M-%S)"
backup_base="$BACKUP_DIR/werewolf_${backup_timestamp}.sql.gz"
backup_file="$backup_base"
[ -z "$age_recipient" ] || backup_file="$backup_base.age"
deletion_ledger_file="$BACKUP_DIR/werewolf_deletion_ledger.tsv.age"
temporary_sql="$(mktemp "$BACKUP_DIR/.werewolf_dump.XXXXXX")"
temporary_gzip="$(mktemp "$BACKUP_DIR/.werewolf_dump.XXXXXX.gz")"
temporary_encrypted="$backup_file.tmp"
temporary_deletion_ledger="$(mktemp "$BACKUP_DIR/.werewolf_deletion_ledger.XXXXXX.tsv")"
temporary_encrypted_deletion_ledger="$deletion_ledger_file.tmp"

cleanup() {
  rm -f "$temporary_sql" "$temporary_gzip" "$temporary_encrypted" \
    "$temporary_deletion_ledger" "$temporary_encrypted_deletion_ledger"
  [ -z "$provenance_dir" ] || rm -rf "$provenance_dir"
}
trap cleanup EXIT HUP INT TERM
postgres_container="$(resolve_postgres_container)"
verify_unchanged_provenance

if [ -n "$postgres_container" ]; then
  "$docker_command" exec -i "$postgres_container" \
    pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > "$temporary_sql"
else
  "$docker_command" compose exec -T postgres \
    pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > "$temporary_sql"
fi
test -s "$temporary_sql"

if [ -n "$rclone_remote" ]; then
  printf 'werewolf-deletion-ledger-v1\n' > "$temporary_deletion_ledger"
  if [ -n "$postgres_container" ]; then
    "$docker_command" exec -i "$postgres_container" \
      psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atqc "
        SELECT original_user_id || E'\t' || anonymous_user_id
        FROM public.deleted_user_identities
        ORDER BY original_user_id;
      " >> "$temporary_deletion_ledger"
  else
    "$docker_command" compose exec -T postgres \
      psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atqc "
        SELECT original_user_id || E'\t' || anonymous_user_id
        FROM public.deleted_user_identities
        ORDER BY original_user_id;
      " >> "$temporary_deletion_ledger"
  fi
fi

verify_unchanged_provenance
gzip -c "$temporary_sql" > "$temporary_gzip"
gzip -t "$temporary_gzip"
if [ -n "$age_recipient" ]; then
  "$age_command" -r "$age_recipient" -o "$temporary_encrypted" "$temporary_gzip"
  test -s "$temporary_encrypted"
  mv "$temporary_encrypted" "$backup_file"
else
  mv "$temporary_gzip" "$backup_file"
fi
(cd "$(dirname "$backup_file")" && sha256sum "$(basename "$backup_file")" > "$(basename "$backup_file").sha256")
if [ "$require_signature" = "1" ]; then
  node --jitless "$manifest_command" create \
    "$backup_file" \
    "$signing_private_key" \
    "$POSTGRES_DB" \
    "$release_version" \
    "$migration_head" >/dev/null
fi

if [ -n "$rclone_remote" ]; then
  "$age_command" -r "$age_recipient" \
    -o "$temporary_encrypted_deletion_ledger" "$temporary_deletion_ledger"
  test -s "$temporary_encrypted_deletion_ledger"
  mv "$temporary_encrypted_deletion_ledger" "$deletion_ledger_file"
  (cd "$(dirname "$deletion_ledger_file")" && \
    sha256sum "$(basename "$deletion_ledger_file")" > "$(basename "$deletion_ledger_file").sha256")
  node --jitless "$manifest_command" create \
    "$deletion_ledger_file" \
    "$signing_private_key" \
    "$POSTGRES_DB" \
    "$release_version" \
    "$migration_head" >/dev/null
fi
find "$BACKUP_DIR" -type f \( \
  -name "werewolf_*.sql.gz" -o \
  -name "werewolf_*.sql.gz.sha256" -o \
  -name "werewolf_*.sql.gz.age" -o \
  -name "werewolf_*.sql.gz.age.sha256" -o \
  -name "werewolf_*.manifest.json" -o \
  -name "werewolf_*.manifest.json.sig" \
\) -mtime +"$BACKUP_RETENTION_DAYS" -delete

if [ -n "$rclone_remote" ]; then
  ledger_name="$(basename "$deletion_ledger_file")"
  "$rclone_command" copyto "$deletion_ledger_file" "$deletion_ledger_remote/$ledger_name"
  "$rclone_command" copyto "$deletion_ledger_file.sha256" "$deletion_ledger_remote/$ledger_name.sha256"
  "$rclone_command" copyto "$deletion_ledger_file.manifest.json" \
    "$deletion_ledger_remote/$ledger_name.manifest.json"
  "$rclone_command" copyto "$deletion_ledger_file.manifest.json.sig" \
    "$deletion_ledger_remote/$ledger_name.manifest.json.sig"

  "$rclone_command" copy "$backup_file" "$rclone_remote"
  "$rclone_command" copy "$backup_file.sha256" "$rclone_remote"
  "$rclone_command" copy "$backup_file.manifest.json" "$rclone_remote"
  "$rclone_command" copy "$backup_file.manifest.json.sig" "$rclone_remote"
fi

printf 'Backup written: %s\n' "$backup_file"
if [ -n "$rclone_remote" ]; then
  printf 'Protected deletion ledger written: %s\n' "$deletion_ledger_file"
fi
