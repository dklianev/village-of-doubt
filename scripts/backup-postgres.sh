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
backup_file="$BACKUP_DIR/werewolf_$(date +%F_%H-%M-%S).sql.gz"
temporary_sql="$(mktemp "$BACKUP_DIR/.werewolf_dump.XXXXXX")"
temporary_gzip="$backup_file.tmp"

cleanup() {
  rm -f "$temporary_sql" "$temporary_gzip"
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
