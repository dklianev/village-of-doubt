#!/usr/bin/env sh
set -eu

BACKUP_DIR="${BACKUP_DIR:-/backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
POSTGRES_USER="${POSTGRES_USER:-werewolf}"
POSTGRES_DB="${POSTGRES_DB:-werewolf}"
docker_command="${BACKUP_DOCKER_COMMAND:-docker}"
fixed_container="${BACKUP_POSTGRES_CONTAINER:-}"
compose_project="${BACKUP_COMPOSE_PROJECT:-}"
require_fixed_container="${BACKUP_REQUIRE_FIXED_CONTAINER:-0}"
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
release_manifest_command="${BACKUP_RELEASE_MANIFEST_COMMAND:-$(dirname "$0")/release-manifest.mjs}"
release_manifest_public_key="${BACKUP_RELEASE_MANIFEST_PUBLIC_KEY_FILE:-/etc/werewolf/release-manifest.pub}"
release_allowed_image_prefix="${BACKUP_RELEASE_ALLOWED_IMAGE_PREFIX:-}"

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
  provenance_env="$(mktemp)"
  trap 'rm -f "$provenance_env"' EXIT HUP INT TERM
  node "$release_manifest_command" "$release_manifest" \
    --signature "$release_manifest_signature" \
    --public-key "$release_manifest_public_key" \
    --allowed-image-prefix "$release_allowed_image_prefix" \
    --env-output "$provenance_env"
  # release-manifest.mjs writes shell-safe, validated tokens only.
  # shellcheck disable=SC1090
  . "$provenance_env"
  release_version="$RELEASE_VERSION"
  migration_head="$MIGRATION_HEAD"
  rm -f "$provenance_env"
  trap - EXIT HUP INT TERM
fi

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
  if [ -n "$fixed_container" ]; then
    validate_docker_identifier "$fixed_container" "BACKUP_POSTGRES_CONTAINER"
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

mkdir -p "$BACKUP_DIR"
backup_base="$BACKUP_DIR/werewolf_$(date +%F_%H-%M-%S).sql.gz"
backup_file="$backup_base"
[ -z "$age_recipient" ] || backup_file="$backup_base.age"
temporary_sql="$(mktemp "$BACKUP_DIR/.werewolf_dump.XXXXXX")"
temporary_gzip="$(mktemp "$BACKUP_DIR/.werewolf_dump.XXXXXX.gz")"
temporary_encrypted="$backup_file.tmp"

cleanup() {
  rm -f "$temporary_sql" "$temporary_gzip" "$temporary_encrypted"
}
trap cleanup EXIT HUP INT TERM
postgres_container="$(resolve_postgres_container)"

if [ -n "$postgres_container" ]; then
  "$docker_command" exec -i "$postgres_container" \
    pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > "$temporary_sql"
else
  "$docker_command" compose exec -T postgres \
    pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > "$temporary_sql"
fi
test -s "$temporary_sql"
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
  node "$manifest_command" create \
    "$backup_file" \
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

if [ -n "${RCLONE_REMOTE:-}" ]; then
  if ! command -v rclone >/dev/null 2>&1; then
    printf 'RCLONE_REMOTE is set, but rclone is unavailable.\n' >&2
    exit 1
  fi
  rclone copy "$backup_file" "$RCLONE_REMOTE"
  rclone copy "$backup_file.sha256" "$RCLONE_REMOTE"
  if [ "$require_signature" = "1" ]; then
    rclone copy "$backup_file.manifest.json" "$RCLONE_REMOTE"
    rclone copy "$backup_file.manifest.json.sig" "$RCLONE_REMOTE"
  fi
fi

printf 'Backup written: %s\n' "$backup_file"
