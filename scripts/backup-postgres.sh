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
age_recipient="${BACKUP_AGE_RECIPIENT:-}"
age_command="${BACKUP_AGE_COMMAND:-age}"

case "$require_encryption" in
  0|1) ;;
  *)
    printf 'BACKUP_REQUIRE_ENCRYPTION must be 0 or 1.\n' >&2
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
find "$BACKUP_DIR" -type f \( \
  -name "werewolf_*.sql.gz" -o \
  -name "werewolf_*.sql.gz.sha256" -o \
  -name "werewolf_*.sql.gz.age" -o \
  -name "werewolf_*.sql.gz.age.sha256" \
\) -mtime +"$BACKUP_RETENTION_DAYS" -delete

if [ -n "${RCLONE_REMOTE:-}" ]; then
  if ! command -v rclone >/dev/null 2>&1; then
    printf 'RCLONE_REMOTE is set, but rclone is unavailable.\n' >&2
    exit 1
  fi
  rclone copy "$backup_file" "$RCLONE_REMOTE"
  rclone copy "$backup_file.sha256" "$RCLONE_REMOTE"
fi

printf 'Backup written: %s\n' "$backup_file"
