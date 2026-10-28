#!/usr/bin/env sh
set -eu

script_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
# shellcheck disable=SC1091
. "$script_dir/deploy-operations-lib.sh"

manifest_path="${1:-}"
if [ -z "$manifest_path" ]; then
  echo "Usage: scripts/deploy-release.sh <release.json>" >&2
  exit 2
fi

release_dir="${RELEASE_STATE_DIR:-/var/lib/werewolf/release-state}"
generated_env="$release_dir/candidate.env"
current_manifest="$release_dir/current.json"
previous_manifest="$release_dir/previous.json"
schema_manifest="$release_dir/schema-current.json"
pending_migration_manifest="$release_dir/migration-pending.json"
schema_check_env="$release_dir/schema-check.env"
schema_manifest_tmp="$release_dir/schema-current.json.$$"
schema_signature_tmp="$release_dir/schema-current.json.sig.$$"
backup_service="${BACKUP_SYSTEMD_SERVICE:-werewolf-backup.service}"
manifest_signature="${RELEASE_MANIFEST_SIGNATURE:-${manifest_path}.sig}"
operations_lock_dir="${OPERATIONS_LOCK_DIR:-$release_dir/operations.lock}"
git_command="${RELEASE_GIT_COMMAND:-git}"

case "$backup_service" in
  ""|*[!A-Za-z0-9@_.-]*)
    echo "BACKUP_SYSTEMD_SERVICE contains unsafe characters." >&2
    exit 2
    ;;
esac

initialize_compose_project
initialize_drain_timeouts
prepare_release_state "$release_dir"

drain_armed=0
drain_start_pending=0
forensics_enabled=0
operation_release="unvalidated"
migration_container_started=0
migrator_container_name=""
cancel_drain_on_exit() {
  exit_code=$?
  trap - EXIT HUP INT TERM
  if [ "$drain_start_pending" -eq 1 ]; then
    operations_lock_held=0
    write_maintenance_marker "$release_dir" 'drain start outcome unconfirmed; host lock retained' || true
  fi
  if [ "$drain_armed" -eq 1 ]; then
    cancel_drain_bounded || true
  fi
  if [ "$exit_code" -ne 0 ] && [ "$migration_container_started" -eq 1 ]; then
    preserve_and_stop_container "docker" "$migrator_container_name" "$release_dir" \
      "deploy-migrator" || true
  fi
  if [ "$exit_code" -ne 0 ] && [ "$forensics_enabled" -eq 1 ] && [ -f "$generated_env" ]; then
    preserve_compose_forensics "deploy-failed" "$operation_release" "$release_dir" "$generated_env"
  fi
  rm -f "$schema_check_env" "$schema_manifest_tmp" "$schema_signature_tmp"
  release_operations_lock
  exit "$exit_code"
}
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM
trap cancel_drain_on_exit EXIT

acquire_operations_lock "deploy" "$operations_lock_dir"

node --env-file-if-exists=.env scripts/release-manifest.mjs "$manifest_path" \
  --signature "$manifest_signature" \
  --env-output "$generated_env"
chmod 600 "$generated_env"

set -a
# shellcheck disable=SC1090
. "$generated_env"
set +a
operation_release="$RELEASE_VERSION"
migrator_container_name="werewolf-migrator-$RELEASE_VERSION"

source_commit="$({
  GIT_CONFIG_NOSYSTEM=1 \
  GIT_CONFIG_GLOBAL=/dev/null \
  "$git_command" -c "safe.directory=$PWD" -c core.hooksPath=/dev/null \
    rev-parse --verify 'HEAD^{commit}'
} 2>/dev/null)" || {
  echo "Release source checkout commit could not be verified." >&2
  exit 1
}
case "$source_commit" in
  [0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]* ) ;;
  * )
    echo "Release source checkout returned an invalid commit." >&2
    exit 1
    ;;
esac
if [ "$(printf '%s' "$source_commit" | tr 'A-F' 'a-f')" != "$RELEASE_VERSION" ]; then
  echo "Release source checkout $source_commit does not match signed manifest sourceCommit $RELEASE_VERSION." >&2
  exit 1
fi

node --env-file=.env scripts/check-production-env.mjs

health_timeout_seconds="${RELEASE_HEALTH_TIMEOUT_SECONDS:-240}"
health_poll_seconds="${RELEASE_HEALTH_POLL_INTERVAL_SECONDS:-2}"
compose_wait_timeout_seconds="${COMPOSE_WAIT_TIMEOUT_SECONDS:-120}"
migration_lock_timeout_ms="${MIGRATION_LOCK_TIMEOUT_MS:-5000}"
migration_statement_timeout_ms="${MIGRATION_STATEMENT_TIMEOUT_MS:-300000}"
migration_idle_timeout_ms="${MIGRATION_IDLE_TRANSACTION_TIMEOUT_MS:-300000}"
migration_process_timeout_seconds="${MIGRATION_PROCESS_TIMEOUT_SECONDS:-600}"
require_positive_integer "RELEASE_HEALTH_TIMEOUT_SECONDS" "$health_timeout_seconds"
require_positive_integer "RELEASE_HEALTH_POLL_INTERVAL_SECONDS" "$health_poll_seconds"
require_positive_integer "COMPOSE_WAIT_TIMEOUT_SECONDS" "$compose_wait_timeout_seconds"
require_positive_integer "MIGRATION_LOCK_TIMEOUT_MS" "$migration_lock_timeout_ms"
require_positive_integer "MIGRATION_STATEMENT_TIMEOUT_MS" "$migration_statement_timeout_ms"
require_positive_integer "MIGRATION_IDLE_TRANSACTION_TIMEOUT_MS" "$migration_idle_timeout_ms"
require_positive_integer "MIGRATION_PROCESS_TIMEOUT_SECONDS" "$migration_process_timeout_seconds"
if [ "$migration_lock_timeout_ms" -ge "$migration_statement_timeout_ms" ] || \
  [ "$migration_statement_timeout_ms" -ge $((migration_process_timeout_seconds * 1000)) ] || \
  [ "$migration_idle_timeout_ms" -ge $((migration_process_timeout_seconds * 1000)) ]; then
  echo "Migration lock/statement/idle timeouts must fit inside MIGRATION_PROCESS_TIMEOUT_SECONDS." >&2
  exit 2
fi
migration_pgoptions="-c lock_timeout=$migration_lock_timeout_ms -c statement_timeout=$migration_statement_timeout_ms -c idle_in_transaction_session_timeout=$migration_idle_timeout_ms"
health_attempts=$(( (health_timeout_seconds + health_poll_seconds - 1) / health_poll_seconds ))

validate_schema_manifest() {
  schema_candidate="$1"
  node --env-file-if-exists=.env scripts/release-manifest.mjs "$schema_candidate" \
    --signature "$schema_candidate.sig" \
    --env-output "$schema_check_env"
  rm -f "$schema_check_env"
}

initialize_schema_state() {
  if [ -e "$pending_migration_manifest" ] || [ -e "$pending_migration_manifest.sig" ]; then
    reason="migration pending marker exists; the prior migration outcome must be investigated"
    write_maintenance_marker "$release_dir" "$reason"
    echo "MAINTENANCE REQUIRED: $reason." >&2
    exit 3
  fi

  if [ -e "$schema_manifest" ] || [ -e "$schema_manifest.sig" ]; then
    if [ ! -f "$schema_manifest" ] || [ ! -f "$schema_manifest.sig" ]; then
      reason="applied-schema manifest is incomplete"
      write_maintenance_marker "$release_dir" "$reason"
      echo "MAINTENANCE REQUIRED: $reason." >&2
      exit 3
    fi
    validate_schema_manifest "$schema_manifest"
    return
  fi

  if [ -e "$current_manifest" ] || [ -e "$current_manifest.sig" ]; then
    if [ ! -f "$current_manifest" ] || [ ! -f "$current_manifest.sig" ]; then
      reason="active release manifest is incomplete, so schema provenance cannot be initialized"
      write_maintenance_marker "$release_dir" "$reason"
      echo "MAINTENANCE REQUIRED: $reason." >&2
      exit 3
    fi
    validate_schema_manifest "$current_manifest"
    cp "$current_manifest" "$schema_manifest"
    cp "$current_manifest.sig" "$schema_manifest.sig"
    allow_release_state_readers "$schema_manifest" "$schema_manifest.sig"
  fi
}

mark_migration_pending() {
  cp "$manifest_path" "$pending_migration_manifest"
  cp "$manifest_signature" "$pending_migration_manifest.sig"
  allow_release_state_readers "$pending_migration_manifest" "$pending_migration_manifest.sig"
}

mark_schema_applied() {
  cp "$manifest_path" "$schema_manifest_tmp"
  cp "$manifest_signature" "$schema_signature_tmp"
  allow_release_state_readers "$schema_manifest_tmp" "$schema_signature_tmp"
  mv "$schema_signature_tmp" "$schema_manifest.sig"
  mv "$schema_manifest_tmp" "$schema_manifest"
  rm -f "$pending_migration_manifest" "$pending_migration_manifest.sig"
}

docker compose --env-file .env --env-file "$generated_env" config --quiet
forensics_enabled=1
initialize_schema_state
docker compose --env-file .env --env-file "$generated_env" pull migrate web game caddy

if [ "${SKIP_DEPLOY_DRAIN:-0}" != "1" ]; then
  existing_game="$(run_with_process_timeout 10 docker compose ps -q game)"
  if [ -n "$existing_game" ]; then
    run_with_process_timeout 10 docker compose exec -T game \
      wget -qO- http://127.0.0.1:2567/health -T 5 >/dev/null
    drain_armed=1
    run_deploy_drain
  fi
fi

if [ "${SKIP_DEPLOY_BACKUP:-0}" != "1" ]; then
  if [ "$(id -u)" -eq 0 ]; then
    systemctl start "$backup_service"
  else
    sudo -n systemctl start "$backup_service"
  fi
fi

docker compose --env-file .env --env-file "$generated_env" \
  up -d --wait --wait-timeout "$compose_wait_timeout_seconds" postgres redis
docker compose --env-file .env --env-file "$generated_env" run --rm --no-deps postgres-roles
mark_migration_pending
migration_container_started=1
run_with_process_timeout "$migration_process_timeout_seconds" \
  docker compose --env-file .env --env-file "$generated_env" \
  run --name "$migrator_container_name" --rm --no-deps \
  -e "PGOPTIONS=$migration_pgoptions" -e "MIGRATION_HEAD=$MIGRATION_HEAD" \
  migrate node ./migrator.mjs
migration_container_started=0
mark_schema_applied
docker compose --env-file .env --env-file "$generated_env" run --rm --no-deps postgres-grants
docker compose --env-file .env --env-file "$generated_env" \
  up -d --force-recreate --no-build --no-deps web game caddy
drain_armed=0

attempt=1
health_deadline=$(( $(date +%s) + health_timeout_seconds ))
while [ "$attempt" -le "$health_attempts" ] && [ "$(date +%s)" -lt "$health_deadline" ]; do
  web_health="$(run_before_deadline "$health_deadline" 10 docker compose --env-file .env --env-file "$generated_env" ps --format json web 2>/dev/null | grep -o '"Health":"[^"]*"' | head -1 || true)"
  game_health="$(run_before_deadline "$health_deadline" 10 docker compose --env-file .env --env-file "$generated_env" ps --format json game 2>/dev/null | grep -o '"Health":"[^"]*"' | head -1 || true)"
  caddy_health="$(run_before_deadline "$health_deadline" 10 docker compose --env-file .env --env-file "$generated_env" ps --format json caddy 2>/dev/null | grep -o '"Health":"[^"]*"' | head -1 || true)"
  web_readiness="unready"
  if run_before_deadline "$health_deadline" 10 docker compose --env-file .env --env-file "$generated_env" exec -T web \
    wget -qO- http://127.0.0.1:3000/api/health/ready -T 5 >/dev/null 2>&1; then
    web_readiness="ready"
  fi
  if [ "$web_health" = '"Health":"healthy"' ] && \
    [ "$game_health" = '"Health":"healthy"' ] && \
    [ "$caddy_health" = '"Health":"healthy"' ] && \
    [ "$web_readiness" = "ready" ] && \
    run_before_deadline "$health_deadline" "$health_timeout_seconds" node --env-file=.env scripts/deploy-public-health.mjs; then
    if [ -f "$current_manifest" ]; then
      cp "$current_manifest" "$previous_manifest"
      if [ -f "$current_manifest.sig" ]; then
        cp "$current_manifest.sig" "$previous_manifest.sig"
      else
        rm -f "$previous_manifest.sig"
      fi
      allow_release_state_readers "$previous_manifest"
      if [ -f "$previous_manifest.sig" ]; then
        allow_release_state_readers "$previous_manifest.sig"
      fi
    fi
    cp "$manifest_path" "$current_manifest"
    cp "$manifest_signature" "$current_manifest.sig"
    allow_release_state_readers "$current_manifest" "$current_manifest.sig"
    rm -f "$generated_env"
    echo "Release $RELEASE_VERSION is healthy."
    exit 0
  fi
  run_before_deadline "$health_deadline" "$health_poll_seconds" sleep "$health_poll_seconds" || true
  attempt=$((attempt + 1))
done

echo "Release failed readiness checks. Healthy release pointers remain unchanged." >&2
if [ -f "$current_manifest" ] && [ -f "$current_manifest.sig" ]; then
  echo "Recovery target is the last healthy signed manifest: $current_manifest" >&2
  echo "From its matching immutable source checkout, run scripts/rollback-release.sh '$current_manifest' only after diagnosing migration compatibility." >&2
  echo "Rollback still requires an exact applied-schema match and no unresolved migration; otherwise use the database restore runbook." >&2
else
  echo "No healthy signed release is recorded. Remain in maintenance and use the database restore runbook; no image rollback target is available." >&2
fi
exit 1
